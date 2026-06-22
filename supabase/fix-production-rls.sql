-- Production hardening for real college deployment
-- Run AFTER: schema.sql, schema-roles.sql, schema-dept-course.sql, fix-rls-recursion.sql,
--            schema-attendance.sql, fix-enrollment-validation.sql, schema-institute-content.sql,
--            fix-teacher-submissions.sql, fix-face-images.sql

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Security-definer helpers
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.teacher_can_access_student(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles teacher
    JOIN public.profiles student ON student.id = p_student_id
    WHERE teacher.id = auth.uid()
      AND teacher.role = 'teacher'
      AND student.role = 'student'
      AND teacher.department_id IS NOT NULL
      AND (
        student.department_id = teacher.department_id
        OR EXISTS (
          SELECT 1 FROM public.courses c
          WHERE c.id = student.course_id
            AND c.department_id = teacher.department_id
        )
        OR EXISTS (
          SELECT 1 FROM public.class_enrollments ce
          JOIN public.classes cl ON cl.id = ce.class_id
          WHERE ce.student_id = student.id
            AND cl.teacher_id = teacher.id
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.teacher_can_access_student(UUID) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. Profile privilege guard (block self-escalation)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.guard_profile_privileged_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_dept UUID;
  v_handoff_token UUID;
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_handoff_token := NULLIF(current_setting('app.handoff_face_reg', true), '')::uuid;
  EXCEPTION
    WHEN OTHERS THEN
      v_handoff_token := NULL;
  END;

  IF v_handoff_token IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.face_registration_handoff_tokens t
      WHERE t.id = v_handoff_token
        AND t.student_id = OLD.id
        AND t.status = 'pending'
        AND t.expires_at > NOW()
    ) THEN
      RAISE EXCEPTION 'Invalid or expired face registration handoff.';
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role
      OR NEW.course_id IS DISTINCT FROM OLD.course_id
      OR NEW.department_id IS DISTINCT FROM OLD.department_id
      OR NEW.roll_number IS DISTINCT FROM OLD.roll_number
      OR NEW.email IS DISTINCT FROM OLD.email
      OR NEW.name IS DISTINCT FROM OLD.name
    THEN
      RAISE EXCEPTION 'Handoff may only update face registration fields.';
    END IF;

    RETURN NEW;
  END IF;

  IF OLD.id = auth.uid() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'You cannot change your own role. Contact an administrator.';
    END IF;
    IF OLD.role = 'student' THEN
      IF NEW.course_id IS DISTINCT FROM OLD.course_id THEN
        RAISE EXCEPTION 'Admission course can only be changed by an administrator.';
      END IF;
      IF NEW.department_id IS DISTINCT FROM OLD.department_id THEN
        RAISE EXCEPTION 'Department can only be changed by an administrator.';
      END IF;
      IF NEW.roll_number IS DISTINCT FROM OLD.roll_number THEN
        RAISE EXCEPTION 'Roll number can only be changed by staff.';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF public.get_user_role() = 'teacher' AND OLD.role = 'student' AND public.teacher_can_access_student(OLD.id) THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Teachers cannot change user roles.';
    END IF;
    SELECT department_id INTO v_teacher_dept FROM public.profiles WHERE id = auth.uid();
    IF NEW.department_id IS NOT NULL AND NEW.department_id IS DISTINCT FROM OLD.department_id THEN
      IF NEW.department_id IS DISTINCT FROM v_teacher_dept THEN
        RAISE EXCEPTION 'You can only assign students within your department.';
      END IF;
    END IF;
    IF NEW.course_id IS NOT NULL AND NEW.course_id IS DISTINCT FROM OLD.course_id THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id = NEW.course_id AND c.department_id = v_teacher_dept
      ) THEN
        RAISE EXCEPTION 'Admitted course must be in your department.';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to update this profile.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_fields ON public.profiles;
CREATE TRIGGER trg_guard_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_privileged_fields();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. Profile RLS — teachers can view/update department students
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Teachers view department students" ON public.profiles;
DROP POLICY IF EXISTS "Teachers update department students" ON public.profiles;
DROP POLICY IF EXISTS "Admin update all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id
    OR public.is_admin()
    OR public.teacher_can_access_student(id)
  );

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Teachers update department students" ON public.profiles
  FOR UPDATE USING (
    public.get_user_role() = 'teacher'
    AND role = 'student'
    AND public.teacher_can_access_student(id)
  );

CREATE POLICY "Admin update all profiles" ON public.profiles
  FOR UPDATE USING (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Assignments & exams — must teach the class to create/edit
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Teachers manage class assignments" ON public.assignments;
DROP POLICY IF EXISTS "Teachers select class assignments" ON public.assignments;
DROP POLICY IF EXISTS "Teachers insert class assignments" ON public.assignments;
DROP POLICY IF EXISTS "Teachers update class assignments" ON public.assignments;
DROP POLICY IF EXISTS "Teachers delete class assignments" ON public.assignments;

CREATE POLICY "Teachers select class assignments" ON public.assignments
  FOR SELECT USING (
    public.is_admin()
    OR (class_id IS NOT NULL AND public.user_teaches_class(class_id))
    OR (class_id IS NULL AND auth.uid() = user_id AND public.get_user_role() != 'student')
  );

CREATE POLICY "Teachers insert class assignments" ON public.assignments
  FOR INSERT WITH CHECK (
    public.is_admin()
    OR (class_id IS NOT NULL AND public.user_teaches_class(class_id))
    OR (class_id IS NULL AND auth.uid() = user_id AND public.get_user_role() != 'student')
  );

CREATE POLICY "Teachers update class assignments" ON public.assignments
  FOR UPDATE USING (
    public.is_admin()
    OR (class_id IS NOT NULL AND public.user_teaches_class(class_id))
    OR (class_id IS NULL AND auth.uid() = user_id AND public.get_user_role() != 'student')
  );

CREATE POLICY "Teachers delete class assignments" ON public.assignments
  FOR DELETE USING (
    public.is_admin()
    OR (class_id IS NOT NULL AND public.user_teaches_class(class_id))
    OR (class_id IS NULL AND auth.uid() = user_id AND public.get_user_role() != 'student')
  );

DROP POLICY IF EXISTS "Teachers manage class exams" ON public.exams;
DROP POLICY IF EXISTS "Teachers select class exams" ON public.exams;
DROP POLICY IF EXISTS "Teachers insert class exams" ON public.exams;
DROP POLICY IF EXISTS "Teachers update class exams" ON public.exams;
DROP POLICY IF EXISTS "Teachers delete class exams" ON public.exams;

CREATE POLICY "Teachers select class exams" ON public.exams
  FOR SELECT USING (
    public.is_admin()
    OR (class_id IS NOT NULL AND public.user_teaches_class(class_id))
    OR (class_id IS NULL AND auth.uid() = user_id AND public.get_user_role() != 'student')
  );

CREATE POLICY "Teachers insert class exams" ON public.exams
  FOR INSERT WITH CHECK (
    public.is_admin()
    OR (class_id IS NOT NULL AND public.user_teaches_class(class_id))
    OR (class_id IS NULL AND auth.uid() = user_id AND public.get_user_role() != 'student')
  );

CREATE POLICY "Teachers update class exams" ON public.exams
  FOR UPDATE USING (
    public.is_admin()
    OR (class_id IS NOT NULL AND public.user_teaches_class(class_id))
    OR (class_id IS NULL AND auth.uid() = user_id AND public.get_user_role() != 'student')
  );

CREATE POLICY "Teachers delete class exams" ON public.exams
  FOR DELETE USING (
    public.is_admin()
    OR (class_id IS NOT NULL AND public.user_teaches_class(class_id))
    OR (class_id IS NULL AND auth.uid() = user_id AND public.get_user_role() != 'student')
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. Class teacher must match course department
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.validate_class_teacher_department()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.teacher_id IS NOT NULL AND NEW.course_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.courses c ON c.id = NEW.course_id
      WHERE p.id = NEW.teacher_id
        AND p.role = 'teacher'
        AND p.department_id IS NOT NULL
        AND p.department_id = c.department_id
    ) THEN
      RAISE EXCEPTION 'Teacher must belong to the same department as the class course.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_class_teacher ON public.classes;
CREATE TRIGGER trg_validate_class_teacher
  BEFORE INSERT OR UPDATE OF teacher_id, course_id ON public.classes
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_class_teacher_department();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. Sync enrollments when student admission course changes
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.sync_enrollments_on_course_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'student' AND NEW.course_id IS DISTINCT FROM OLD.course_id THEN
    DELETE FROM public.class_enrollments ce
    USING public.classes c
    WHERE ce.student_id = NEW.id
      AND ce.class_id = c.id
      AND (c.course_id IS NULL OR c.course_id IS DISTINCT FROM NEW.course_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_enrollments_on_course_change ON public.profiles;
CREATE TRIGGER trg_sync_enrollments_on_course_change
  AFTER UPDATE OF course_id ON public.profiles
  FOR EACH ROW
  WHEN (OLD.course_id IS DISTINCT FROM NEW.course_id)
  EXECUTE FUNCTION public.sync_enrollments_on_course_change();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. Enrollment — only students; must match admitted course
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.validate_class_enrollment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_id UUID;
  v_student_course UUID;
  v_role TEXT;
BEGIN
  SELECT c.course_id INTO v_course_id FROM public.classes c WHERE c.id = NEW.class_id;
  IF v_course_id IS NULL THEN
    RAISE EXCEPTION 'Class has no course assigned';
  END IF;

  SELECT p.course_id, p.role INTO v_student_course, v_role
  FROM public.profiles p WHERE p.id = NEW.student_id;

  IF v_role IS DISTINCT FROM 'student' THEN
    RAISE EXCEPTION 'Only students can be enrolled in classes';
  END IF;

  IF v_student_course IS NULL THEN
    RAISE EXCEPTION 'Student has no admission course. Assign course on profile first.';
  END IF;

  IF v_student_course <> v_course_id THEN
    RAISE EXCEPTION 'Student can only enroll in classes for their admitted course';
  END IF;

  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. Notifications — only staff can broadcast
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Authenticated insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "System insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Staff insert notifications" ON public.notifications;

CREATE POLICY "Staff insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'teacher')
    OR auth.uid() = user_id
  );

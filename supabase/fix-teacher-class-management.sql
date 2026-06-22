-- Teacher class management: create classes, enroll students, seed assignment submissions.
-- Run AFTER fix-production-rls.sql and fix-teacher-submissions.sql

-- ─── Classes: teachers create & delete own sections ───────────────────────────

DROP POLICY IF EXISTS "Teachers insert own classes" ON public.classes;
DROP POLICY IF EXISTS "Teachers delete own classes" ON public.classes;

CREATE POLICY "Teachers insert own classes" ON public.classes
  FOR INSERT WITH CHECK (
    teacher_id = auth.uid()
    AND public.get_user_role() = 'teacher'
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.courses c ON c.id = course_id
      WHERE p.id = auth.uid()
        AND p.role = 'teacher'
        AND p.department_id IS NOT NULL
        AND p.department_id = c.department_id
    )
  );

CREATE POLICY "Teachers delete own classes" ON public.classes
  FOR DELETE USING (teacher_id = auth.uid());

-- ─── Enrollments: teachers manage rosters for classes they teach ──────────────

DROP POLICY IF EXISTS "Teachers insert class enrollments" ON public.class_enrollments;
DROP POLICY IF EXISTS "Teachers delete class enrollments" ON public.class_enrollments;

CREATE POLICY "Teachers insert class enrollments" ON public.class_enrollments
  FOR INSERT WITH CHECK (public.user_teaches_class(class_id));

CREATE POLICY "Teachers delete class enrollments" ON public.class_enrollments
  FOR DELETE USING (public.user_teaches_class(class_id));

-- ─── Assignment submissions: teachers seed rows when posting assignments ──────

DROP POLICY IF EXISTS "Teachers insert class submissions" ON public.assignment_submissions;

CREATE POLICY "Teachers insert class submissions" ON public.assignment_submissions
  FOR INSERT WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_submissions.assignment_id
        AND public.user_teaches_class(a.class_id)
    )
  );

-- ─── Face registration handoff: teachers can start QR for their students ─────

DROP POLICY IF EXISTS "Students manage own face reg handoff" ON public.face_registration_handoff_tokens;
DROP POLICY IF EXISTS "Teachers manage student face reg handoff" ON public.face_registration_handoff_tokens;

CREATE POLICY "Students manage own face reg handoff" ON public.face_registration_handoff_tokens
  FOR ALL USING (
    student_id = auth.uid()
    OR public.is_admin()
    OR (
      public.get_user_role() = 'teacher'
      AND public.teacher_can_access_student(student_id)
    )
  )
  WITH CHECK (
    student_id = auth.uid()
    OR public.is_admin()
    OR (
      public.get_user_role() = 'teacher'
      AND public.teacher_can_access_student(student_id)
    )
  );

NOTIFY pgrst, 'reload schema';

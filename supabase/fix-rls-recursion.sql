-- Fix infinite recursion in RLS policies (classes ↔ enrollments ↔ profiles)
-- Run this in Supabase SQL Editor after schema-roles.sql and schema-dept-course.sql

-- ─── Security-definer helpers (bypass RLS) ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = auth.uid()),
    'student'
  );
$$;

CREATE OR REPLACE FUNCTION public.user_teaches_class(p_class_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes
    WHERE id = p_class_id AND teacher_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.user_enrolled_in_class(p_class_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_enrollments
    WHERE class_id = p_class_id AND student_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_teaches_class(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_enrolled_in_class(UUID) TO authenticated;

-- ─── Profiles (remove duplicate / recursive policies) ─────────────────────────
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id OR public.is_admin());

-- ─── Classes ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin full access classes" ON public.classes;
DROP POLICY IF EXISTS "Teachers view own classes" ON public.classes;
DROP POLICY IF EXISTS "Teachers update own classes" ON public.classes;
DROP POLICY IF EXISTS "Students view enrolled classes" ON public.classes;

CREATE POLICY "Admin full access classes" ON public.classes
  FOR ALL USING (public.is_admin());

CREATE POLICY "Teachers view own classes" ON public.classes
  FOR SELECT USING (teacher_id = auth.uid() OR public.is_admin());

CREATE POLICY "Teachers update own classes" ON public.classes
  FOR UPDATE USING (teacher_id = auth.uid());

CREATE POLICY "Students view enrolled classes" ON public.classes
  FOR SELECT USING (public.user_enrolled_in_class(id));

-- ─── Class enrollments ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin full access enrollments" ON public.class_enrollments;
DROP POLICY IF EXISTS "Students view own enrollments" ON public.class_enrollments;
DROP POLICY IF EXISTS "Teachers view class enrollments" ON public.class_enrollments;

CREATE POLICY "Admin full access enrollments" ON public.class_enrollments
  FOR ALL USING (public.is_admin());

CREATE POLICY "Students view own enrollments" ON public.class_enrollments
  FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Teachers view class enrollments" ON public.class_enrollments
  FOR SELECT USING (public.user_teaches_class(class_id));

-- ─── Class attendance (aggregate) ───────────────────────────────────────────
DROP POLICY IF EXISTS "Students view own class attendance" ON public.class_attendance;
DROP POLICY IF EXISTS "Teachers manage class attendance" ON public.class_attendance;
DROP POLICY IF EXISTS "Admin full access class attendance" ON public.class_attendance;

CREATE POLICY "Students view own class attendance" ON public.class_attendance
  FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Teachers manage class attendance" ON public.class_attendance
  FOR ALL USING (public.user_teaches_class(class_id) OR public.is_admin());

-- ─── Assignments ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Teachers manage class assignments" ON public.assignments;
DROP POLICY IF EXISTS "Students view class assignments" ON public.assignments;
DROP POLICY IF EXISTS "Admin full access assignments" ON public.assignments;

CREATE POLICY "Teachers manage class assignments" ON public.assignments
  FOR ALL USING (
    created_by = auth.uid()
    OR public.user_teaches_class(class_id)
    OR public.is_admin()
  );

CREATE POLICY "Students view class assignments" ON public.assignments
  FOR SELECT USING (
    class_id IS NOT NULL AND public.user_enrolled_in_class(class_id)
  );

CREATE POLICY "Admin full access assignments" ON public.assignments
  FOR ALL USING (public.is_admin());

-- ─── Exams ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Teachers manage class exams" ON public.exams;
DROP POLICY IF EXISTS "Students view class exams" ON public.exams;

CREATE POLICY "Teachers manage class exams" ON public.exams
  FOR ALL USING (
    created_by = auth.uid()
    OR public.user_teaches_class(class_id)
    OR public.is_admin()
  );

CREATE POLICY "Students view class exams" ON public.exams
  FOR SELECT USING (
    class_id IS NOT NULL AND public.user_enrolled_in_class(class_id)
  );

-- ─── Assignment submissions ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Teachers view class submissions" ON public.assignment_submissions;
DROP POLICY IF EXISTS "Admin full access submissions" ON public.assignment_submissions;

CREATE POLICY "Teachers view class submissions" ON public.assignment_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_submissions.assignment_id
        AND public.user_teaches_class(a.class_id)
    )
  );

CREATE POLICY "Admin full access submissions" ON public.assignment_submissions
  FOR ALL USING (public.is_admin());

-- ─── Departments & courses ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin full access departments" ON public.departments;
DROP POLICY IF EXISTS "Authenticated read departments" ON public.departments;
DROP POLICY IF EXISTS "Admin full access courses" ON public.courses;
DROP POLICY IF EXISTS "Authenticated read courses" ON public.courses;

CREATE POLICY "Admin full access departments" ON public.departments
  FOR ALL USING (public.is_admin());

CREATE POLICY "Authenticated read departments" ON public.departments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access courses" ON public.courses
  FOR ALL USING (public.is_admin());

CREATE POLICY "Authenticated read courses" ON public.courses
  FOR SELECT USING (auth.role() = 'authenticated');

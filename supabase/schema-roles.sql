-- Student Companion — Institution / Role-Based Access (Option B)
-- Run AFTER the base schema.sql on an existing project.
-- Safe for first run: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.

-- ─── 1. Roles on profiles ───────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student'
    CHECK (role IN ('admin', 'teacher', 'student'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS roll_number TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS department TEXT;

-- Helper: get current user's role (for RLS)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- ─── 2. Classes & enrollments ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  department TEXT,
  teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.class_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_classes_teacher ON public.classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_class ON public.class_enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON public.class_enrollments(student_id);

-- ─── 3. Extend assignments & exams for classes ────────────────────────────────
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE;

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

CREATE TABLE IF NOT EXISTS public.assignment_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed')),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(assignment_id, student_id)
);

ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE;

ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Teacher-managed attendance per class
CREATE TABLE IF NOT EXISTS public.class_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_classes INTEGER NOT NULL DEFAULT 0 CHECK (total_classes >= 0),
  attended_classes INTEGER NOT NULL DEFAULT 0 CHECK (attended_classes >= 0),
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, student_id),
  CONSTRAINT class_attended_lte_total CHECK (attended_classes <= total_classes)
);

-- ─── 4. Notifications ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info'
    CHECK (type IN ('info', 'success', 'warning', 'assignment', 'exam', 'attendance')),
  read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, read);

-- ─── 5. Update signup trigger (default role = student) ──────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ─── 6. Notify students helper ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_class_students(
  p_class_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'info',
  p_link TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, link)
  SELECT ce.student_id, p_title, p_message, p_type, p_link
  FROM public.class_enrollments ce
  WHERE ce.class_id = p_class_id;
END;
$$;

-- ─── 7. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Profiles: admin can read/update all; users own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (
    auth.uid() = id
    OR public.get_user_role() = 'admin'
  );

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Admin can list all profiles (teachers/students management)
CREATE POLICY "Admin can view all profiles" ON public.profiles
  FOR SELECT USING (public.get_user_role() = 'admin');

-- Classes
CREATE POLICY "Admin full access classes" ON public.classes
  FOR ALL USING (public.get_user_role() = 'admin');

CREATE POLICY "Teachers view own classes" ON public.classes
  FOR SELECT USING (teacher_id = auth.uid() OR public.get_user_role() = 'admin');

CREATE POLICY "Teachers update own classes" ON public.classes
  FOR UPDATE USING (teacher_id = auth.uid());

CREATE POLICY "Students view enrolled classes" ON public.classes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.class_enrollments ce
      WHERE ce.class_id = classes.id AND ce.student_id = auth.uid()
    )
  );

-- Enrollments
CREATE POLICY "Admin full access enrollments" ON public.class_enrollments
  FOR ALL USING (public.get_user_role() = 'admin');

CREATE POLICY "Students view own enrollments" ON public.class_enrollments
  FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Teachers view class enrollments" ON public.class_enrollments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_enrollments.class_id AND c.teacher_id = auth.uid()
    )
  );

-- Assignment submissions
CREATE POLICY "Students manage own submissions" ON public.assignment_submissions
  FOR ALL USING (student_id = auth.uid());

CREATE POLICY "Teachers view class submissions" ON public.assignment_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.classes c ON c.id = a.class_id
      WHERE a.id = assignment_submissions.assignment_id AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Admin full access submissions" ON public.assignment_submissions
  FOR ALL USING (public.get_user_role() = 'admin');

-- Class attendance
CREATE POLICY "Students view own class attendance" ON public.class_attendance
  FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Teachers manage class attendance" ON public.class_attendance
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_attendance.class_id AND c.teacher_id = auth.uid()
    )
    OR public.get_user_role() = 'admin'
  );

CREATE POLICY "Admin full access class attendance" ON public.class_attendance
  FOR ALL USING (public.get_user_role() = 'admin');

-- Notifications
CREATE POLICY "Users view own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "System insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- Extend assignments RLS for teachers
CREATE POLICY "Teachers manage class assignments" ON public.assignments
  FOR ALL USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = assignments.class_id AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students view class assignments" ON public.assignments
  FOR SELECT USING (
    class_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.class_enrollments ce
      WHERE ce.class_id = assignments.class_id AND ce.student_id = auth.uid()
    )
  );

CREATE POLICY "Admin full access assignments" ON public.assignments
  FOR ALL USING (public.get_user_role() = 'admin');

-- Extend exams RLS
CREATE POLICY "Teachers manage class exams" ON public.exams
  FOR ALL USING (created_by = auth.uid() OR public.get_user_role() = 'admin');

CREATE POLICY "Students view class exams" ON public.exams
  FOR SELECT USING (
    class_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.class_enrollments ce
      WHERE ce.class_id = exams.class_id AND ce.student_id = auth.uid()
    )
  );

-- ─── 8. Make yourself admin (edit email!) ─────────────────────────────────────
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'your-email@college.edu';

GRANT EXECUTE ON FUNCTION public.notify_class_students TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role TO authenticated;

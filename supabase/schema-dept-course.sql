-- Student Companion — Department → Course → Class hierarchy
-- Run AFTER schema.sql and schema-roles.sql

-- ─── 1. Departments ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 2. Courses (programs under a department) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  duration_years INTEGER CHECK (duration_years IS NULL OR duration_years > 0),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(department_id, code)
);

CREATE INDEX IF NOT EXISTS idx_courses_department ON public.courses(department_id);

-- ─── 3. Link classes to courses ───────────────────────────────────────────────
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_classes_course ON public.classes(course_id);

-- ─── 4. Link profiles to department / course ──────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_department ON public.profiles(department_id);
CREATE INDEX IF NOT EXISTS idx_profiles_course ON public.profiles(course_id);

-- ─── 5. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access departments" ON public.departments
  FOR ALL USING (public.get_user_role() = 'admin');

CREATE POLICY "Authenticated read departments" ON public.departments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admin full access courses" ON public.courses
  FOR ALL USING (public.get_user_role() = 'admin');

CREATE POLICY "Authenticated read courses" ON public.courses
  FOR SELECT USING (auth.role() = 'authenticated');

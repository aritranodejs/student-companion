-- Institute content model: teachers publish, students view + submit
-- Run after schema-roles.sql and fix-rls-recursion.sql

-- ─── Assignment submissions: file upload + student note ───────────────────────
ALTER TABLE public.assignment_submissions
  ADD COLUMN IF NOT EXISTS file_url TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS student_comment TEXT,
  ADD COLUMN IF NOT EXISTS teacher_feedback TEXT;

-- ─── Google Classroom–style comments ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.assignment_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES public.assignment_submissions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignment_comments_assignment ON public.assignment_comments(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_comments_submission ON public.assignment_comments(submission_id);

-- ─── Teacher-published grades (CGPA) per student ────────────────────────────
ALTER TABLE public.semesters
  ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.semesters
  ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES auth.users(id);

ALTER TABLE public.semesters
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_semesters_student ON public.semesters(student_id);

-- ─── Storage: assignment file uploads ─────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('submissions', 'submissions', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Students upload submission files" ON storage.objects;
DROP POLICY IF EXISTS "Students read own submission files" ON storage.objects;
DROP POLICY IF EXISTS "Teachers read class submission files" ON storage.objects;

CREATE POLICY "Students upload submission files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'submissions'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Students read own submission files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'submissions'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Teachers read class submission files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'submissions'
    AND public.get_user_role() IN ('teacher', 'admin')
  );

-- ─── RLS: comments ────────────────────────────────────────────────────────────
ALTER TABLE public.assignment_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view assignment comments" ON public.assignment_comments;
DROP POLICY IF EXISTS "Users post assignment comments" ON public.assignment_comments;
DROP POLICY IF EXISTS "Admin full access assignment comments" ON public.assignment_comments;

CREATE POLICY "Users view assignment comments" ON public.assignment_comments
  FOR SELECT USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_comments.assignment_id
        AND (
          public.user_teaches_class(a.class_id)
          OR public.user_enrolled_in_class(a.class_id)
        )
    )
  );

CREATE POLICY "Users post assignment comments" ON public.assignment_comments
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_comments.assignment_id
        AND (
          public.user_teaches_class(a.class_id)
          OR public.user_enrolled_in_class(a.class_id)
        )
    )
  );

CREATE POLICY "Admin full access assignment comments" ON public.assignment_comments
  FOR ALL USING (public.is_admin());

-- ─── RLS: teacher-published semesters for students ────────────────────────────
DROP POLICY IF EXISTS "Users can view own semesters" ON public.semesters;
DROP POLICY IF EXISTS "Users can view own subjects" ON public.subjects;

CREATE POLICY "Students view published semesters" ON public.semesters
  FOR SELECT USING (
    student_id = auth.uid()
    OR (student_id IS NULL AND user_id = auth.uid())
  );

CREATE POLICY "Teachers manage published semesters" ON public.semesters
  FOR ALL USING (
    published_by = auth.uid()
    OR public.user_teaches_class(class_id)
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Students view published subjects" ON public.subjects;
DROP POLICY IF EXISTS "Teachers manage published subjects" ON public.subjects;

CREATE POLICY "Students view published subjects" ON public.subjects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.semesters s
      WHERE s.id = subjects.semester_id
        AND (s.student_id = auth.uid() OR (s.student_id IS NULL AND s.user_id = auth.uid()))
    )
  );

CREATE POLICY "Teachers manage published subjects" ON public.subjects
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.semesters s
      WHERE s.id = subjects.semester_id
        AND (s.published_by = auth.uid() OR public.is_admin())
    )
  );

-- Students: teachers publish academic content; students view + submit only
DROP POLICY IF EXISTS "Users can insert own assignments" ON public.assignments;
DROP POLICY IF EXISTS "Users can update own assignments" ON public.assignments;
DROP POLICY IF EXISTS "Users can delete own assignments" ON public.assignments;
DROP POLICY IF EXISTS "Users can insert own exams" ON public.exams;
DROP POLICY IF EXISTS "Users can update own exams" ON public.exams;
DROP POLICY IF EXISTS "Users can delete own exams" ON public.exams;
DROP POLICY IF EXISTS "Users can insert own semesters" ON public.semesters;
DROP POLICY IF EXISTS "Users can update own semesters" ON public.semesters;
DROP POLICY IF EXISTS "Users can delete own semesters" ON public.semesters;
DROP POLICY IF EXISTS "Users can insert own subjects" ON public.subjects;
DROP POLICY IF EXISTS "Users can update own subjects" ON public.subjects;
DROP POLICY IF EXISTS "Users can delete own subjects" ON public.subjects;

CREATE POLICY "Non-students manage personal assignments" ON public.assignments
  FOR ALL USING (
    public.get_user_role() != 'student' AND auth.uid() = user_id AND class_id IS NULL
  );

CREATE POLICY "Non-students manage personal exams" ON public.exams
  FOR ALL USING (
    public.get_user_role() != 'student' AND auth.uid() = user_id AND class_id IS NULL
  );

CREATE POLICY "Teachers admins publish grades" ON public.semesters
  FOR INSERT WITH CHECK (public.get_user_role() IN ('teacher', 'admin'));

CREATE POLICY "Teachers admins update grades" ON public.semesters
  FOR UPDATE USING (published_by = auth.uid() OR public.is_admin());

CREATE POLICY "Teachers admins delete grades" ON public.semesters
  FOR DELETE USING (published_by = auth.uid() OR public.is_admin());

CREATE POLICY "Teachers admins manage grade subjects" ON public.subjects
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.semesters s
      WHERE s.id = subjects.semester_id
        AND (s.published_by = auth.uid() OR public.is_admin())
    )
  );

-- Students: block creating personal assignments (class_id required for insert via app; DB guard optional)
DROP POLICY IF EXISTS "Students insert class assignments only" ON public.assignments;
DROP POLICY IF EXISTS "Students cannot create assignments" ON public.assignments;

DROP POLICY IF EXISTS "Students cannot create exams" ON public.exams;

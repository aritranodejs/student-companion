-- Allow teachers to grade submissions and leave feedback
-- Run after schema-institute-content.sql

DROP POLICY IF EXISTS "Teachers update class submissions" ON public.assignment_submissions;

CREATE POLICY "Teachers update class submissions" ON public.assignment_submissions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_submissions.assignment_id
        AND public.user_teaches_class(a.class_id)
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Teachers read submission files" ON storage.objects;
CREATE POLICY "Teachers read submission files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'submissions'
    AND public.get_user_role() IN ('teacher', 'admin')
  );

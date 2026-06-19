-- Face snapshot for attendance verification (run after schema-attendance.sql)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS face_image_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('face-images', 'face-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Students upload own face image" ON storage.objects;
DROP POLICY IF EXISTS "Students update own face image" ON storage.objects;
DROP POLICY IF EXISTS "Teachers read face images" ON storage.objects;
DROP POLICY IF EXISTS "Admin full access face images" ON storage.objects;

CREATE POLICY "Students upload own face image" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'face-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Students update own face image" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'face-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Teachers read face images" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'face-images'
    AND (
      public.is_admin()
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('teacher', 'admin'))
    )
  );

CREATE POLICY "Admin full access face images" ON storage.objects
  FOR ALL USING (
    bucket_id = 'face-images' AND public.is_admin()
  );

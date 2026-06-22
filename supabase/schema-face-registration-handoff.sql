-- Mobile QR handoff for face registration (PC without camera → register on phone)
-- Run AFTER schema-attendance-handoff.sql
-- THEN also run schema-handoff-anonymous.sql (required for phone QR without login)

CREATE TABLE IF NOT EXISTS public.face_registration_handoff_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP INDEX IF EXISTS idx_face_reg_handoff_one_pending;
CREATE UNIQUE INDEX idx_face_reg_handoff_one_pending
  ON public.face_registration_handoff_tokens (student_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_face_reg_handoff_expires ON public.face_registration_handoff_tokens(expires_at);

ALTER TABLE public.face_registration_handoff_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students manage own face reg handoff" ON public.face_registration_handoff_tokens;
DROP POLICY IF EXISTS "Admin full access face reg handoff" ON public.face_registration_handoff_tokens;

CREATE POLICY "Students manage own face reg handoff" ON public.face_registration_handoff_tokens
  FOR ALL USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Admin full access face reg handoff" ON public.face_registration_handoff_tokens
  FOR ALL USING (public.is_admin());

-- Mobile QR handoff for attendance (PC without camera → scan with phone)
-- Run AFTER fix-production-rls.sql

ALTER TABLE public.attendance_logs
  DROP CONSTRAINT IF EXISTS attendance_logs_method_check;

ALTER TABLE public.attendance_logs
  ADD CONSTRAINT attendance_logs_method_check
  CHECK (method IN ('face', 'location', 'manual', 'student_app', 'mobile'));

CREATE TABLE IF NOT EXISTS public.attendance_handoff_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  attendance_log_id UUID REFERENCES public.attendance_logs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one pending token per student+session (partial unique index)
DROP INDEX IF EXISTS idx_handoff_one_pending;
CREATE UNIQUE INDEX idx_handoff_one_pending
  ON public.attendance_handoff_tokens (student_id, session_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_handoff_student ON public.attendance_handoff_tokens(student_id);
CREATE INDEX IF NOT EXISTS idx_handoff_expires ON public.attendance_handoff_tokens(expires_at);

ALTER TABLE public.attendance_handoff_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students manage own handoff tokens" ON public.attendance_handoff_tokens;
DROP POLICY IF EXISTS "Admin full access handoff tokens" ON public.attendance_handoff_tokens;

CREATE POLICY "Students manage own handoff tokens" ON public.attendance_handoff_tokens
  FOR ALL USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Admin full access handoff tokens" ON public.attendance_handoff_tokens
  FOR ALL USING (public.is_admin());

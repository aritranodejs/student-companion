-- Daily attendance: face verification + location + CSV export support
-- Run AFTER fix-rls-recursion.sql

-- ─── Campus location on classes ───────────────────────────────────────────────
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS campus_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS campus_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS campus_radius_m INTEGER DEFAULT 150;

-- ─── Face registration on profiles ────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS face_descriptor JSONB,
  ADD COLUMN IF NOT EXISTS face_registered_at TIMESTAMPTZ;

-- ─── Daily attendance sessions (teacher opens per class per day) ───────────────
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  opens_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closes_at TIMESTAMPTZ,
  require_face BOOLEAN NOT NULL DEFAULT true,
  require_location BOOLEAN NOT NULL DEFAULT true,
  campus_lat DOUBLE PRECISION,
  campus_lng DOUBLE PRECISION,
  campus_radius_m INTEGER DEFAULT 150,
  is_open BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, session_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_class ON public.attendance_sessions(class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_date ON public.attendance_sessions(session_date);

-- ─── Per-student daily attendance logs ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'present'
    CHECK (status IN ('present', 'absent', 'late', 'excused')),
  method TEXT NOT NULL DEFAULT 'student_app'
    CHECK (method IN ('face', 'location', 'manual', 'student_app')),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  face_match_score DOUBLE PRECISION,
  face_verified BOOLEAN NOT NULL DEFAULT false,
  location_verified BOOLEAN NOT NULL DEFAULT false,
  marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  marked_by UUID REFERENCES auth.users(id),
  notes TEXT,
  UNIQUE(session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_logs_session ON public.attendance_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_class ON public.attendance_logs(class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_student ON public.attendance_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_date ON public.attendance_logs(marked_at);

-- ─── Sync aggregate class_attendance when daily log is marked present ───────────
CREATE OR REPLACE FUNCTION public.sync_class_attendance_on_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('present', 'late') THEN
    INSERT INTO public.class_attendance (class_id, student_id, total_classes, attended_classes, updated_by)
    VALUES (
      NEW.class_id,
      NEW.student_id,
      1,
      1,
      NEW.marked_by
    )
    ON CONFLICT (class_id, student_id) DO UPDATE SET
      total_classes = public.class_attendance.total_classes + 1,
      attended_classes = public.class_attendance.attended_classes + 1,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW();
  ELSIF NEW.status = 'absent' THEN
    INSERT INTO public.class_attendance (class_id, student_id, total_classes, attended_classes, updated_by)
    VALUES (NEW.class_id, NEW.student_id, 1, 0, NEW.marked_by)
    ON CONFLICT (class_id, student_id) DO UPDATE SET
      total_classes = public.class_attendance.total_classes + 1,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_class_attendance ON public.attendance_logs;
CREATE TRIGGER trg_sync_class_attendance
  AFTER INSERT ON public.attendance_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_class_attendance_on_log();

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access attendance sessions" ON public.attendance_sessions;
DROP POLICY IF EXISTS "Teachers manage own class sessions" ON public.attendance_sessions;
DROP POLICY IF EXISTS "Students view enrolled class sessions" ON public.attendance_sessions;

CREATE POLICY "Admin full access attendance sessions" ON public.attendance_sessions
  FOR ALL USING (public.is_admin());

CREATE POLICY "Teachers manage own class sessions" ON public.attendance_sessions
  FOR ALL USING (public.user_teaches_class(class_id));

CREATE POLICY "Students view enrolled class sessions" ON public.attendance_sessions
  FOR SELECT USING (public.user_enrolled_in_class(class_id));

DROP POLICY IF EXISTS "Admin full access attendance logs" ON public.attendance_logs;
DROP POLICY IF EXISTS "Teachers manage class attendance logs" ON public.attendance_logs;
DROP POLICY IF EXISTS "Students view own attendance logs" ON public.attendance_logs;
DROP POLICY IF EXISTS "Students insert own attendance logs" ON public.attendance_logs;

CREATE POLICY "Admin full access attendance logs" ON public.attendance_logs
  FOR ALL USING (public.is_admin());

CREATE POLICY "Teachers manage class attendance logs" ON public.attendance_logs
  FOR ALL USING (public.user_teaches_class(class_id));

CREATE POLICY "Students view own attendance logs" ON public.attendance_logs
  FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Students insert own attendance logs" ON public.attendance_logs
  FOR INSERT WITH CHECK (
    student_id = auth.uid()
    AND public.user_enrolled_in_class(class_id)
  );

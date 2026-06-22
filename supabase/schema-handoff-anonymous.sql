-- Anonymous QR handoff: complete face registration / attendance on phone without login.
-- The UUID token in the QR URL is the secret (generated while student is logged in on PC).
-- Run AFTER schema-face-registration-handoff.sql

CREATE OR REPLACE FUNCTION public.haversine_distance_m(
  lat1 DOUBLE PRECISION,
  lon1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lon2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 6371000 * 2 * atan2(
    sqrt(
      sin(radians(lat2 - lat1) / 2) ^ 2
      + cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lon2 - lon1) / 2) ^ 2
    ),
    sqrt(
      1 - (
        sin(radians(lat2 - lat1) / 2) ^ 2
        + cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lon2 - lon1) / 2) ^ 2
      )
    )
  );
$$;

-- ─── Face registration handoff ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_face_registration_handoff(p_token_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tok public.face_registration_handoff_tokens%ROWTYPE;
  v_name TEXT;
  v_has_face BOOLEAN;
BEGIN
  IF p_token_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid QR code.');
  END IF;

  SELECT * INTO v_tok FROM public.face_registration_handoff_tokens WHERE id = p_token_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid or expired QR code.');
  END IF;

  IF v_tok.expires_at < NOW() AND v_tok.status = 'pending' THEN
    UPDATE public.face_registration_handoff_tokens
    SET status = 'expired'
    WHERE id = p_token_id AND status = 'pending';
    RETURN jsonb_build_object('ok', false, 'error', 'This QR code has expired. Generate a new one from your PC.');
  END IF;

  IF v_tok.status <> 'pending' THEN
    IF v_tok.status = 'completed' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Face already registered from this QR code.');
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'This QR code has expired.');
  END IF;

  SELECT p.name, (p.face_descriptor IS NOT NULL)
  INTO v_name, v_has_face
  FROM public.profiles p
  WHERE p.id = v_tok.student_id;

  RETURN jsonb_build_object(
    'ok', true,
    'handoff', jsonb_build_object(
      'id', v_tok.id,
      'student_id', v_tok.student_id,
      'expires_at', v_tok.expires_at,
      'status', v_tok.status
    ),
    'student', jsonb_build_object('name', v_name, 'has_face', COALESCE(v_has_face, false))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_face_registration_handoff(
  p_token_id UUID,
  p_descriptor JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tok public.face_registration_handoff_tokens%ROWTYPE;
BEGIN
  IF p_token_id IS NULL OR p_descriptor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Face data is required.');
  END IF;

  SELECT * INTO v_tok
  FROM public.face_registration_handoff_tokens
  WHERE id = p_token_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid or expired QR code.');
  END IF;

  IF v_tok.status <> 'pending' OR v_tok.expires_at < NOW() THEN
    IF v_tok.status = 'pending' AND v_tok.expires_at < NOW() THEN
      UPDATE public.face_registration_handoff_tokens SET status = 'expired' WHERE id = p_token_id;
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'This QR code has expired.');
  END IF;

  UPDATE public.profiles
  SET
    face_descriptor = p_descriptor,
    face_registered_at = NOW()
  WHERE id = v_tok.student_id;

  UPDATE public.face_registration_handoff_tokens
  SET status = 'completed', completed_at = NOW()
  WHERE id = p_token_id;

  RETURN jsonb_build_object('ok', true, 'student_id', v_tok.student_id);
END;
$$;

-- ─── Attendance handoff ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_attendance_handoff(p_token_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tok public.attendance_handoff_tokens%ROWTYPE;
  v_sess public.attendance_sessions%ROWTYPE;
  v_cls public.classes%ROWTYPE;
  v_name TEXT;
  v_face JSONB;
  v_existing UUID;
BEGIN
  IF p_token_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid QR code.');
  END IF;

  SELECT * INTO v_tok FROM public.attendance_handoff_tokens WHERE id = p_token_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid or expired QR code.');
  END IF;

  IF v_tok.expires_at < NOW() AND v_tok.status = 'pending' THEN
    UPDATE public.attendance_handoff_tokens
    SET status = 'expired'
    WHERE id = p_token_id AND status = 'pending';
    RETURN jsonb_build_object('ok', false, 'error', 'This QR code has expired. Generate a new one from your PC.');
  END IF;

  IF v_tok.status <> 'pending' THEN
    IF v_tok.status = 'completed' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Attendance already marked from this QR code.');
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'This QR code has expired.');
  END IF;

  SELECT * INTO v_sess FROM public.attendance_sessions WHERE id = v_tok.session_id;
  IF NOT FOUND OR NOT v_sess.is_open THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Attendance session is closed.');
  END IF;

  SELECT * INTO v_cls FROM public.classes WHERE id = v_tok.class_id;

  SELECT p.name, p.face_descriptor
  INTO v_name, v_face
  FROM public.profiles p
  WHERE p.id = v_tok.student_id;

  SELECT id INTO v_existing
  FROM public.attendance_logs
  WHERE session_id = v_tok.session_id AND student_id = v_tok.student_id;

  RETURN jsonb_build_object(
    'ok', true,
    'handoff', jsonb_build_object(
      'id', v_tok.id,
      'student_id', v_tok.student_id,
      'session_id', v_tok.session_id,
      'class_id', v_tok.class_id,
      'expires_at', v_tok.expires_at,
      'status', v_tok.status
    ),
    'session', jsonb_build_object(
      'id', v_sess.id,
      'class_id', v_sess.class_id,
      'require_face', v_sess.require_face,
      'require_location', v_sess.require_location,
      'campus_lat', COALESCE(v_sess.campus_lat, v_cls.campus_lat),
      'campus_lng', COALESCE(v_sess.campus_lng, v_cls.campus_lng),
      'campus_radius_m', COALESCE(v_sess.campus_radius_m, v_cls.campus_radius_m, 150),
      'is_open', v_sess.is_open,
      'class', jsonb_build_object(
        'id', v_cls.id,
        'name', v_cls.name,
        'code', v_cls.code,
        'campus_lat', v_cls.campus_lat,
        'campus_lng', v_cls.campus_lng,
        'campus_radius_m', v_cls.campus_radius_m
      )
    ),
    'profile', jsonb_build_object('name', v_name, 'face_descriptor', v_face),
    'existing_log_id', v_existing
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_attendance_handoff(
  p_token_id UUID,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_face_verified BOOLEAN,
  p_face_match_score DOUBLE PRECISION,
  p_method TEXT DEFAULT 'mobile'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tok public.attendance_handoff_tokens%ROWTYPE;
  v_sess public.attendance_sessions%ROWTYPE;
  v_cls public.classes%ROWTYPE;
  v_campus_lat DOUBLE PRECISION;
  v_campus_lng DOUBLE PRECISION;
  v_radius INTEGER;
  v_location_verified BOOLEAN := false;
  v_log_id UUID;
  v_method TEXT;
  v_dist DOUBLE PRECISION;
BEGIN
  IF p_token_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid QR code.');
  END IF;

  SELECT * INTO v_tok
  FROM public.attendance_handoff_tokens
  WHERE id = p_token_id
  FOR UPDATE;

  IF NOT FOUND OR v_tok.status <> 'pending' OR v_tok.expires_at < NOW() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This QR code has expired.');
  END IF;

  SELECT * INTO v_sess FROM public.attendance_sessions WHERE id = v_tok.session_id;
  IF NOT FOUND OR NOT v_sess.is_open THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Attendance session is closed.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.attendance_logs
    WHERE session_id = v_tok.session_id AND student_id = v_tok.student_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You already marked attendance for this class today.');
  END IF;

  SELECT * INTO v_cls FROM public.classes WHERE id = v_tok.class_id;

  IF v_sess.require_face AND NOT COALESCE(p_face_verified, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Face verification failed.');
  END IF;

  v_campus_lat := COALESCE(v_sess.campus_lat, v_cls.campus_lat);
  v_campus_lng := COALESCE(v_sess.campus_lng, v_cls.campus_lng);
  v_radius := COALESCE(v_sess.campus_radius_m, v_cls.campus_radius_m, 150);

  IF v_sess.require_location THEN
    IF p_latitude IS NULL OR p_longitude IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'GPS location is required.');
    END IF;
    IF v_campus_lat IS NULL OR v_campus_lng IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Campus location is not set. Attendance cannot be marked yet.');
    END IF;
    v_dist := public.haversine_distance_m(p_latitude, p_longitude, v_campus_lat, v_campus_lng);
    IF v_dist > v_radius THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', format('You must be on campus (within %sm) to mark attendance', v_radius)
      );
    END IF;
    v_location_verified := true;
  END IF;

  v_method := COALESCE(NULLIF(p_method, ''), 'mobile');
  IF v_method NOT IN ('face', 'location', 'manual', 'student_app', 'mobile') THEN
    v_method := 'mobile';
  END IF;

  INSERT INTO public.attendance_logs (
    session_id,
    class_id,
    student_id,
    status,
    method,
    latitude,
    longitude,
    face_match_score,
    face_verified,
    location_verified,
    marked_by
  ) VALUES (
    v_tok.session_id,
    v_tok.class_id,
    v_tok.student_id,
    'present',
    v_method,
    p_latitude,
    p_longitude,
    p_face_match_score,
    COALESCE(p_face_verified, false),
    v_location_verified,
    v_tok.student_id
  )
  RETURNING id INTO v_log_id;

  UPDATE public.attendance_handoff_tokens
  SET
    status = 'completed',
    completed_at = NOW(),
    attendance_log_id = v_log_id
  WHERE id = p_token_id;

  RETURN jsonb_build_object(
    'ok', true,
    'log_id', v_log_id,
    'class_name', v_cls.name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_face_registration_handoff(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_face_registration_handoff(UUID, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_attendance_handoff(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_attendance_handoff(UUID, DOUBLE PRECISION, DOUBLE PRECISION, BOOLEAN, DOUBLE PRECISION, TEXT) TO anon, authenticated;

-- Force PostgREST / Supabase API to pick up new RPC functions immediately
NOTIFY pgrst, 'reload schema';

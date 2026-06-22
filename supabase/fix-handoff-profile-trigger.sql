-- Fix: QR face registration on phone fails with "Not authorized to update this profile."
-- Cause: guard_profile_privileged_fields blocks updates when auth.uid() is null (no login on phone).
-- Run this in Supabase SQL Editor (after schema-handoff-anonymous.sql).

CREATE OR REPLACE FUNCTION public.guard_profile_privileged_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_dept UUID;
  v_handoff_token UUID;
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Anonymous QR face registration handoff (valid pending token only)
  BEGIN
    v_handoff_token := NULLIF(current_setting('app.handoff_face_reg', true), '')::uuid;
  EXCEPTION
    WHEN OTHERS THEN
      v_handoff_token := NULL;
  END;

  IF v_handoff_token IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.face_registration_handoff_tokens t
      WHERE t.id = v_handoff_token
        AND t.student_id = OLD.id
        AND t.status = 'pending'
        AND t.expires_at > NOW()
    ) THEN
      RAISE EXCEPTION 'Invalid or expired face registration handoff.';
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role
      OR NEW.course_id IS DISTINCT FROM OLD.course_id
      OR NEW.department_id IS DISTINCT FROM OLD.department_id
      OR NEW.roll_number IS DISTINCT FROM OLD.roll_number
      OR NEW.email IS DISTINCT FROM OLD.email
      OR NEW.name IS DISTINCT FROM OLD.name
    THEN
      RAISE EXCEPTION 'Handoff may only update face registration fields.';
    END IF;

    RETURN NEW;
  END IF;

  IF OLD.id = auth.uid() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'You cannot change your own role. Contact an administrator.';
    END IF;
    IF OLD.role = 'student' THEN
      IF NEW.course_id IS DISTINCT FROM OLD.course_id THEN
        RAISE EXCEPTION 'Admission course can only be changed by an administrator.';
      END IF;
      IF NEW.department_id IS DISTINCT FROM OLD.department_id THEN
        RAISE EXCEPTION 'Department can only be changed by an administrator.';
      END IF;
      IF NEW.roll_number IS DISTINCT FROM OLD.roll_number THEN
        RAISE EXCEPTION 'Roll number can only be changed by staff.';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF public.get_user_role() = 'teacher' AND OLD.role = 'student' AND public.teacher_can_access_student(OLD.id) THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Teachers cannot change user roles.';
    END IF;
    SELECT department_id INTO v_teacher_dept FROM public.profiles WHERE id = auth.uid();
    IF NEW.department_id IS NOT NULL AND NEW.department_id IS DISTINCT FROM OLD.department_id THEN
      IF NEW.department_id IS DISTINCT FROM v_teacher_dept THEN
        RAISE EXCEPTION 'You can only assign students within your department.';
      END IF;
    END IF;
    IF NEW.course_id IS NOT NULL AND NEW.course_id IS DISTINCT FROM OLD.course_id THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id = NEW.course_id AND c.department_id = v_teacher_dept
      ) THEN
        RAISE EXCEPTION 'Admitted course must be in your department.';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to update this profile.';
  END IF;

  RETURN NEW;
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

  PERFORM set_config('app.handoff_face_reg', p_token_id::text, true);

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

NOTIFY pgrst, 'reload schema';

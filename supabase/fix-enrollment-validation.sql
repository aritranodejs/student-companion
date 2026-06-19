-- DB-level guard: students enroll only in their admitted course
CREATE OR REPLACE FUNCTION public.validate_class_enrollment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_id UUID;
  v_student_course UUID;
  v_role TEXT;
BEGIN
  SELECT c.course_id INTO v_course_id FROM public.classes c WHERE c.id = NEW.class_id;
  IF v_course_id IS NULL THEN
    RAISE EXCEPTION 'Class has no course assigned';
  END IF;

  SELECT p.course_id, p.role INTO v_student_course, v_role
  FROM public.profiles p WHERE p.id = NEW.student_id;

  IF v_role = 'student' THEN
    IF v_student_course IS NULL THEN
      RAISE EXCEPTION 'Student has no admission course. Assign course on profile first.';
    END IF;
    IF v_student_course <> v_course_id THEN
      RAISE EXCEPTION 'Student can only enroll in classes for their admitted course';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_class_enrollment ON public.class_enrollments;
CREATE TRIGGER trg_validate_class_enrollment
  BEFORE INSERT ON public.class_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_class_enrollment();

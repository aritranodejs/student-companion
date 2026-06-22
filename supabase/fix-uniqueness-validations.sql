-- Uniqueness & data-quality validations for production
-- Run AFTER fix-teacher-class-management.sql

-- ─── Class code unique per course (not global) ────────────────────────────────
ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_code_key;

DROP INDEX IF EXISTS idx_classes_course_code;
CREATE UNIQUE INDEX idx_classes_course_code
  ON public.classes (course_id, upper(trim(code)))
  WHERE course_id IS NOT NULL;

DROP INDEX IF EXISTS idx_classes_code_no_course;
CREATE UNIQUE INDEX idx_classes_code_no_course
  ON public.classes (upper(trim(code)))
  WHERE course_id IS NULL;

-- ─── Roll number unique per department (students only) ────────────────────────
DROP INDEX IF EXISTS idx_profiles_roll_dept;
CREATE UNIQUE INDEX idx_profiles_roll_dept
  ON public.profiles (department_id, upper(trim(roll_number)))
  WHERE role = 'student'
    AND department_id IS NOT NULL
    AND roll_number IS NOT NULL
    AND trim(roll_number) <> '';

DROP INDEX IF EXISTS idx_profiles_roll_no_dept;
CREATE UNIQUE INDEX idx_profiles_roll_no_dept
  ON public.profiles (upper(trim(roll_number)))
  WHERE role = 'student'
    AND department_id IS NULL
    AND roll_number IS NOT NULL
    AND trim(roll_number) <> '';

-- ─── Trim roll numbers on write ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.normalize_profile_roll_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.roll_number IS NOT NULL THEN
    NEW.roll_number := NULLIF(upper(trim(NEW.roll_number)), '');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_roll_number ON public.profiles;
CREATE TRIGGER trg_normalize_roll_number
  BEFORE INSERT OR UPDATE OF roll_number ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_profile_roll_number();

-- ─── Class must have a course ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_class_has_course()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.course_id IS NULL THEN
    RAISE EXCEPTION 'Every class must be linked to a course.';
  END IF;
  NEW.code := upper(trim(NEW.code));
  NEW.name := trim(NEW.name);
  IF NEW.code = '' OR NEW.name = '' THEN
    RAISE EXCEPTION 'Class name and code are required.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_class_has_course ON public.classes;
CREATE TRIGGER trg_validate_class_has_course
  BEFORE INSERT OR UPDATE OF course_id, code, name ON public.classes
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_class_has_course();

NOTIFY pgrst, 'reload schema';

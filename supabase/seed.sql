-- Student Companion — SQL Seed (reference data only)
-- ─────────────────────────────────────────────────────────────────────────────
-- NOTE: Auth users CANNOT be created reliably via SQL alone.
--       Use `npm run seed` (scripts/seed.mjs) to create admin/teacher/student
--       accounts with passwords.
--
-- This file is useful if users already exist and you only need to:
--   • Promote an existing account to admin
--   • Insert demo classes (after teachers exist)
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Promote existing user to admin (edit email!) ────────────────────────
-- UPDATE public.profiles
-- SET role = 'admin', department = 'Administration'
-- WHERE email = 'your-email@college.edu';

-- ─── 2. Promote teachers (run after users sign up) ──────────────────────────
-- UPDATE public.profiles SET role = 'teacher', department = 'Computer Science'
-- WHERE email IN ('teacher@college.edu', 'teacher2@college.edu');

-- ─── 3. Set student roll numbers ────────────────────────────────────────────
-- UPDATE public.profiles SET role = 'student', roll_number = 'BCA2024001', department = 'BCA'
-- WHERE email = 'student@college.edu';

-- ─── 4. Demo classes (requires teacher profiles to exist) ───────────────────
-- INSERT INTO public.classes (name, code, department, teacher_id)
-- SELECT 'BCA 3rd Year — DBMS', 'BCA3-DBMS', 'Computer Science', id
-- FROM public.profiles WHERE email = 'teacher@college.edu'
-- ON CONFLICT (code) DO NOTHING;

-- INSERT INTO public.classes (name, code, department, teacher_id)
-- SELECT 'MCA 1st Year — Data Structures', 'MCA1-DS', 'IT', id
-- FROM public.profiles WHERE email = 'teacher2@college.edu'
-- ON CONFLICT (code) DO NOTHING;

-- ─── 5. Enroll students (requires classes + student profiles) ───────────────
-- INSERT INTO public.class_enrollments (class_id, student_id)
-- SELECT c.id, p.id
-- FROM public.classes c, public.profiles p
-- WHERE c.code = 'BCA3-DBMS' AND p.email = 'student@college.edu'
-- ON CONFLICT (class_id, student_id) DO NOTHING;

-- INSERT INTO public.class_enrollments (class_id, student_id)
-- SELECT c.id, p.id
-- FROM public.classes c, public.profiles p
-- WHERE c.code = 'BCA3-DBMS' AND p.email = 'student2@college.edu'
-- ON CONFLICT (class_id, student_id) DO NOTHING;

-- ─── Verify seed ──────────────────────────────────────────────────────────────
-- SELECT email, role, department, roll_number FROM public.profiles ORDER BY role, email;
-- SELECT c.name, c.code, p.name AS teacher FROM public.classes c LEFT JOIN public.profiles p ON p.id = c.teacher_id;
-- SELECT c.code, p.email AS student FROM public.class_enrollments e JOIN public.classes c ON c.id = e.class_id JOIN public.profiles p ON p.id = e.student_id;

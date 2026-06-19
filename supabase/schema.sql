-- Student Companion — FIRST-TIME SETUP (no destructive operations)
-- Run this in Supabase SQL Editor on a new project.
-- Safe to confirm/run without the "destructive operations" warning.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_name TEXT NOT NULL,
  total_classes INTEGER NOT NULL DEFAULT 0 CHECK (total_classes >= 0),
  attended_classes INTEGER NOT NULL DEFAULT 0 CHECK (attended_classes >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT attended_lte_total CHECK (attended_classes <= total_classes)
);

-- Assignments table
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Semesters table
CREATE TABLE IF NOT EXISTS semesters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  semester_name TEXT NOT NULL,
  gpa NUMERIC(4, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subjects table (linked to semesters)
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  subject_name TEXT NOT NULL,
  credits INTEGER NOT NULL DEFAULT 0 CHECK (credits > 0),
  grade TEXT NOT NULL CHECK (grade IN ('O', 'A+', 'A', 'B+', 'B', 'C', 'D', 'F'))
);

-- Study sessions table
CREATE TABLE IF NOT EXISTS study_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  duration INTEGER NOT NULL CHECK (duration > 0),
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exams table
CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  exam_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Goals table
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target NUMERIC NOT NULL DEFAULT 100,
  progress NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Badges table (gamification)
CREATE TABLE IF NOT EXISTS badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_type TEXT NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_user ON assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON assignments(due_date);
CREATE INDEX IF NOT EXISTS idx_semesters_user ON semesters(user_id);
CREATE INDEX IF NOT EXISTS idx_subjects_semester ON subjects(semester_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_user ON study_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_date ON study_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_exams_user ON exams(user_id);
CREATE INDEX IF NOT EXISTS idx_exams_date ON exams(exam_date);
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Attendance policies
CREATE POLICY "Users can view own attendance" ON attendance FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own attendance" ON attendance FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own attendance" ON attendance FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own attendance" ON attendance FOR DELETE USING (auth.uid() = user_id);

-- Assignments policies
CREATE POLICY "Users can view own assignments" ON assignments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own assignments" ON assignments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own assignments" ON assignments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own assignments" ON assignments FOR DELETE USING (auth.uid() = user_id);

-- Semesters policies
CREATE POLICY "Users can view own semesters" ON semesters FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own semesters" ON semesters FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own semesters" ON semesters FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own semesters" ON semesters FOR DELETE USING (auth.uid() = user_id);

-- Subjects policies (via semester ownership)
CREATE POLICY "Users can view own subjects" ON subjects FOR SELECT
  USING (EXISTS (SELECT 1 FROM semesters WHERE semesters.id = subjects.semester_id AND semesters.user_id = auth.uid()));
CREATE POLICY "Users can insert own subjects" ON subjects FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM semesters WHERE semesters.id = subjects.semester_id AND semesters.user_id = auth.uid()));
CREATE POLICY "Users can update own subjects" ON subjects FOR UPDATE
  USING (EXISTS (SELECT 1 FROM semesters WHERE semesters.id = subjects.semester_id AND semesters.user_id = auth.uid()));
CREATE POLICY "Users can delete own subjects" ON subjects FOR DELETE
  USING (EXISTS (SELECT 1 FROM semesters WHERE semesters.id = subjects.semester_id AND semesters.user_id = auth.uid()));

-- Study sessions policies
CREATE POLICY "Users can view own study sessions" ON study_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own study sessions" ON study_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own study sessions" ON study_sessions FOR DELETE USING (auth.uid() = user_id);

-- Exams policies
CREATE POLICY "Users can view own exams" ON exams FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own exams" ON exams FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own exams" ON exams FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own exams" ON exams FOR DELETE USING (auth.uid() = user_id);

-- Goals policies
CREATE POLICY "Users can view own goals" ON goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals" ON goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON goals FOR DELETE USING (auth.uid() = user_id);

-- Badges policies
CREATE POLICY "Users can view own badges" ON badges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own badges" ON badges FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Storage bucket for avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

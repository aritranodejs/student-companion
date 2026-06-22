# Student Companion

Institution-grade student management for real colleges: **Department → Course → Class** hierarchy with role-based access for **Admin**, **Teacher**, and **Student**.

## Features

### Institution (Admin / Teacher / Student)
- **Departments & Courses** — BCA, MCA, B.Tech, etc.
- **Classes** — sections under courses with teacher assignment
- **User management** — admission course, roll number, role control
- **Attendance** — face mapping + GPS geofence + manual override + CSV export
- **Assignments** — teacher publishes, students submit with file + comments
- **Grades** — teacher publishes semester results (students read-only)
- **Exams** — class-scoped schedules with notifications

### Student productivity
- Dashboard, study timer, goals, profile, PWA offline support

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React (Vite), Tailwind CSS, Zustand, React Router |
| Backend | Supabase (Auth, PostgreSQL, Storage, RLS) |
| Face | face-api.js (client-side verification) |

## Getting Started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project

### 1. Install

```bash
cd student-companion
npm install
```

### 2. Run ALL SQL migrations (in order)

Open **Supabase → SQL Editor** and run each file **in this exact order**:

| # | File | Purpose |
|---|------|---------|
| 1 | `supabase/schema.sql` | Base tables, auth profiles |
| 2 | `supabase/schema-roles.sql` | Roles, classes, enrollments |
| 3 | `supabase/schema-dept-course.sql` | Departments, courses, FK links |
| 4 | `supabase/fix-rls-recursion.sql` | RLS helpers, fix recursion |
| 5 | `supabase/schema-attendance.sql` | Face, GPS, attendance sessions |
| 6 | `supabase/fix-enrollment-validation.sql` | Course-matched enrollment trigger |
| 7 | `supabase/schema-institute-content.sql` | Submissions, comments, institute grades |
| 8 | `supabase/fix-teacher-submissions.sql` | Teacher submission access |
| 9 | `supabase/fix-face-images.sql` | Face snapshot storage |
| 10 | `supabase/fix-production-rls.sql` | **Production hardening (required)** |
| 11 | `supabase/schema-attendance-handoff.sql` | **QR mobile attendance (PC without camera)** |
| 12 | `supabase/schema-face-registration-handoff.sql` | **QR face registration from phone** |

If signup fails, also run `supabase/fix-signup-trigger.sql`.

### 3. Environment

```bash
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # seed only
```

### 4. Seed (recommended for dev)

```bash
npm run seed
```

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@college.edu | Admin@123456 |
| Teacher | teacher@college.edu | Teacher@123456 |
| Student | student@college.edu | Student@123456 |

**Change all passwords before production.**

### 5. Run

```bash
npm run dev
```

## Production checklist

- [ ] All 10 SQL migrations applied
- [ ] Default seed passwords changed
- [ ] HTTPS enabled (required for camera + GPS)
- [ ] Supabase email auth configured
- [ ] Service role key **not** exposed in frontend

## Role flow

```
Admin → Departments → Courses → Classes → Users (admission course)
     → Enroll students (must match admitted course)
Teacher → Own classes → Attendance / Assignments / Exams / Grades
Student → Face register → Mark attendance → View/submit class work
```

## Security (production)

- Row Level Security on all institution tables
- Students cannot change role, course, or department
- Teachers scoped to department students + own classes
- Class assignments require teaching the class
- Enrollment validated at DB level
- Course change auto-removes invalid enrollments

## License

MIT

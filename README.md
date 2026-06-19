# Student Companion

A modern student productivity platform for BCA, MCA, B.Tech, and college students. Track attendance, assignments, CGPA, study sessions, exams, and academic goals — all from one dashboard.

## Features

- **Dashboard** — Stats, quick actions, deadlines, exam countdowns, attendance alerts, charts
- **Attendance Tracker** — Subject-wise tracking with 75% threshold calculations
- **Assignment Tracker** — Priority, status, due dates, search & filter
- **CGPA Calculator** — Semester-wise GPA/CGPA with grade support (O, A+, A, B+, B, C, D, F)
- **Study Timer** — Pomodoro, Extended Focus, and Custom modes with streak tracking
- **Exam Countdown** — Track upcoming exams with day countdowns
- **Academic Goals** — Progress bars, badges, and achievement tracking
- **Profile & Settings** — Avatar upload, dark/light mode, CSV/JSON import/export
- **PWA** — Installable on Android, iPhone, and Desktop with offline support

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React (Vite), Tailwind CSS, React Router, React Hook Form |
| State | Zustand |
| Charts | Recharts |
| Animations | Framer Motion |
| Backend | Supabase (Auth, PostgreSQL, Storage, Realtime) |
| Hosting | Vercel |

## Getting Started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project

### 1. Clone & Install

```bash
cd student-companion
npm install
```

### 2. Configure Supabase

1. Create a new Supabase project
2. Run SQL migrations in Supabase SQL Editor (in order):
   - `supabase/schema.sql` — base tables
   - `supabase/schema-roles.sql` — roles, classes, notifications
3. Copy environment variables:

```bash
cp .env.example .env
```

Edit `.env`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # for seeding only
```

### 3. Seed the database (recommended)

Creates admin, teachers, students, classes, and sample data:

```bash
npm run seed
```

**Default credentials** (change before production):

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@college.edu | Admin@123456 |
| Teacher | teacher@college.edu | Teacher@123456 |
| Teacher | teacher2@college.edu | Teacher@123456 |
| Student | student@college.edu | Student@123456 |
| Student | student2@college.edu | Student@123456 |
| Student | student3@college.edu | Student@123456 |

Edit users/classes in `supabase/seed.config.js` before re-running.

Safe to re-run — skips existing users and classes.

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### 5. Build for Production

```bash
npm run build
npm run preview
```

## Deploy to Vercel

1. Push the repo to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy — `vercel.json` handles SPA routing

## Project Structure

```
student-companion/
├── public/                  # Static assets, PWA icons
├── src/
│   ├── components/
│   │   ├── layout/          # Sidebar, AppLayout, ProtectedRoute
│   │   └── ui/              # Modal, StatCard, Skeleton, etc.
│   ├── constants/           # Grades, priorities, nav items
│   ├── hooks/               # useAppData (data fetching + offline sync)
│   ├── lib/                 # Supabase client, offline queue
│   ├── pages/               # All route pages
│   ├── stores/              # Zustand stores (auth, theme, data, timer)
│   └── utils/               # Helpers (GPA, attendance, CSV, streaks)
├── supabase/
│   └── schema.sql           # Full database schema with RLS
├── vercel.json
└── vite.config.js           # Tailwind + PWA plugin
```

## Database Schema

Tables: `profiles`, `attendance`, `assignments`, `semesters`, `subjects`, `study_sessions`, `exams`, `goals`, `badges`

All tables have Row Level Security (RLS) — users can only access their own data.

## Security

- Supabase Authentication (email/password)
- Row Level Security on all tables
- Protected routes on the frontend
- Input validation via React Hook Form
- Avatar storage with user-scoped policies

## License

MIT
# student-companion

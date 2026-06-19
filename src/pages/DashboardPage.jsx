import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import {
  HiOutlineClipboardCheck,
  HiOutlineDocumentText,
  HiOutlineAcademicCap,
  HiOutlineClock,
  HiOutlinePlus,
  HiOutlineExclamation,
} from 'react-icons/hi'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useAuthStore, useDataStore } from '../stores'
import { MOTIVATIONAL_QUOTES } from '../constants'
import {
  calcAttendancePercent, calcCGPA, daysUntil, formatHours, getRandomQuote, calcStudyStreak,
} from '../utils/helpers'
import StatCard from '../components/ui/StatCard'
import { CardSkeleton } from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'

export default function DashboardPage() {
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)
  const { attendance, assignments, semesters, studySessions, exams, loading } = useDataStore()

  const quote = useMemo(() => getRandomQuote(MOTIVATIONAL_QUOTES), [])

  const stats = useMemo(() => {
    const overallAttendance = attendance.length
      ? Math.round(attendance.reduce((sum, a) => sum + calcAttendancePercent(a.attended_classes, a.total_classes), 0) / attendance.length)
      : 0
    const pendingAssignments = assignments.filter((a) => a.status !== 'completed').length
    const currentCGPA = calcCGPA(semesters)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const weekSeconds = studySessions
      .filter((s) => new Date(s.session_date) >= weekAgo)
      .reduce((sum, s) => sum + s.duration, 0)
    return { overallAttendance, pendingAssignments, currentCGPA, weekHours: formatHours(weekSeconds) }
  }, [attendance, assignments, semesters, studySessions])

  const upcomingAssignments = useMemo(() =>
    assignments
      .filter((a) => a.status !== 'completed' && daysUntil(a.due_date) >= 0)
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
      .slice(0, 5),
    [assignments]
  )

  const upcomingExams = useMemo(() =>
    exams
      .filter((e) => daysUntil(e.exam_date) >= 0)
      .sort((a, b) => new Date(a.exam_date) - new Date(b.exam_date))
      .slice(0, 5),
    [exams]
  )

  const attendanceAlerts = useMemo(() =>
    attendance
      .map((a) => ({
        ...a,
        percent: calcAttendancePercent(a.attended_classes, a.total_classes),
      }))
      .filter((a) => a.percent < 75)
      .slice(0, 5),
    [attendance]
  )

  const attendanceChartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return months.map((month, i) => {
      const monthAtt = attendance.filter((a) => new Date(a.created_at).getMonth() === i)
      const avg = monthAtt.length
        ? Math.round(monthAtt.reduce((s, a) => s + calcAttendancePercent(a.attended_classes, a.total_classes), 0) / monthAtt.length)
        : 0
      return { month, attendance: avg }
    })
  }, [attendance])

  const studyChartData = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const today = new Date()
    return days.map((day, i) => {
      const d = new Date(today)
      d.setDate(today.getDate() - today.getDay() + i + 1)
      const dateStr = d.toISOString().split('T')[0]
      const seconds = studySessions.filter((s) => s.session_date === dateStr).reduce((sum, s) => sum + s.duration, 0)
      return { day, hours: parseFloat(formatHours(seconds)) }
    })
  }, [studySessions])

  const cgpaChartData = useMemo(() =>
    semesters.map((s) => ({ name: s.semester_name, gpa: s.gpa || 0 })),
    [semesters]
  )

  const quickActions = [
    { label: 'Mark Attendance', path: '/attendance', icon: HiOutlineClipboardCheck },
    { label: 'View Assignments', path: '/assignments', icon: HiOutlineDocumentText },
    { label: 'My CGPA', path: '/cgpa', icon: HiOutlineAcademicCap },
    { label: 'Study Timer', path: '/study', icon: HiOutlineClock },
    { label: 'Upcoming Exams', path: '/exams', icon: HiOutlinePlus },
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-24 w-full rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl border border-indigo-200/40 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent p-6 shadow-xl dark:border-indigo-500/20 dark:from-indigo-500/15 dark:via-purple-500/10 sm:p-8"
      >
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-indigo-500/20 blur-3xl dark:bg-indigo-600/25" />
        <div className="pointer-events-none absolute -bottom-6 left-1/3 h-32 w-32 rounded-full bg-purple-500/15 blur-2xl" />
        <div className="relative">
          <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            Hello, {profile?.name?.split(' ')[0] || 'Student'}{' '}
            <span className="inline-block animate-[wave_2s_ease-in-out_infinite]">👋</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            <span className="font-medium text-indigo-600 dark:text-indigo-400">"</span>
            {quote}
            <span className="font-medium text-indigo-600 dark:text-indigo-400">"</span>
          </p>
        </div>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={HiOutlineClipboardCheck} label="Overall Attendance" value={`${stats.overallAttendance}%`} color="indigo" delay={0} />
        <StatCard icon={HiOutlineDocumentText} label="Pending Assignments" value={stats.pendingAssignments} color="amber" delay={0.05} />
        <StatCard icon={HiOutlineAcademicCap} label="Current CGPA" value={stats.currentCGPA || '—'} color="emerald" delay={0.1} />
        <StatCard icon={HiOutlineClock} label="Study Hours This Week" value={`${stats.weekHours}h`} color="rose" delay={0.15} />
      </div>

      <div className="glass-card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Quick Actions</h2>
        <div className="flex flex-wrap gap-2">
          {quickActions.map(({ label, path, icon: Icon }) => (
            <button
              key={label}
              onClick={() => navigate(path)}
              className="btn-secondary text-xs transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass-card p-5">
          <h2 className="mb-4 font-semibold text-slate-900 dark:text-white">Upcoming Deadlines</h2>
          {upcomingAssignments.length === 0 ? (
            <EmptyState title="No upcoming deadlines" description="Add assignments to track deadlines" />
          ) : (
            <div className="space-y-3">
              {upcomingAssignments.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{a.title}</p>
                    <p className="text-xs text-slate-500">{a.subject}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    daysUntil(a.due_date) <= 2 ? 'bg-red-100 text-red-600 dark:bg-red-950/30' : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/30'
                  }`}>
                    {daysUntil(a.due_date)} days
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card p-5">
          <h2 className="mb-4 font-semibold text-slate-900 dark:text-white">Exam Countdown</h2>
          {upcomingExams.length === 0 ? (
            <EmptyState title="No upcoming exams" description="Add exams to see countdowns" />
          ) : (
            <div className="space-y-3">
              {upcomingExams.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{e.exam_name}</p>
                    <p className="text-xs text-slate-500">{e.subject}</p>
                  </div>
                  <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-600 dark:bg-purple-950/30">
                    {daysUntil(e.exam_date)} days left
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {attendanceAlerts.length > 0 && (
        <div className="glass-card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-amber-600">
            <HiOutlineExclamation className="h-5 w-5" /> Attendance Alerts
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {attendanceAlerts.map((a) => (
              <div key={a.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
                <p className="font-medium text-slate-900 dark:text-white">{a.subject_name}</p>
                <p className="text-sm text-amber-600">Attendance: {a.percent}%</p>
                <p className="mt-1 text-xs text-slate-500">
                  Need {Math.ceil((75 * a.total_classes - 100 * a.attended_classes) / 25)} more classes to reach 75%
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="glass-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Attendance Trend</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={attendanceChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="attendance" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Weekly Study Hours</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={studyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="hours" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">CGPA Progress</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={cgpaChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="gpa" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

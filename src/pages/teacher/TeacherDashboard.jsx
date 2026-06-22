import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { HiOutlineOfficeBuilding, HiOutlineDocumentText, HiOutlineClipboardCheck, HiOutlineCalendar } from 'react-icons/hi'
import { useAuthStore } from '../../stores'
import { useInstitutionStore } from '../../stores/institution'
import StatCard from '../../components/ui/StatCard'

export default function TeacherDashboard() {
  const user = useAuthStore((s) => s.user)
  const { classes, loading, fetchTeacherClasses } = useInstitutionStore()

  useEffect(() => {
    if (user?.id) fetchTeacherClasses(user.id)
  }, [user?.id, fetchTeacherClasses])

  const actions = [
    { to: '/teacher/classes', icon: HiOutlineOfficeBuilding, label: 'Manage Classes', color: 'from-indigo-500 to-violet-600' },
    { to: '/teacher/assignments', icon: HiOutlineDocumentText, label: 'Post Assignment', color: 'from-purple-500 to-indigo-600' },
    { to: '/teacher/attendance', icon: HiOutlineClipboardCheck, label: 'Mark Attendance', color: 'from-teal-500 to-emerald-600' },
    { to: '/teacher/exams', icon: HiOutlineCalendar, label: 'Schedule Exam', color: 'from-rose-500 to-pink-600' },
  ]

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="page-title">Teacher Dashboard</h1>
        <p className="page-subtitle">Manage your classes, assignments, and student progress</p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={HiOutlineOfficeBuilding} label="My Classes" value={classes.length} color="indigo" />
        <StatCard icon={HiOutlineDocumentText} label="Quick Actions" value={4} subtitle="Available tools" color="emerald" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map(({ to, icon: Icon, label, color }) => (
          <Link key={to} to={to} className={`glass-card-hover flex items-center gap-4 p-5 bg-gradient-to-br ${color} text-white`}>
            <Icon className="h-8 w-8 opacity-90" />
            <span className="font-semibold">{label}</span>
          </Link>
        ))}
      </div>

      {!loading && (
        <div className="glass-card p-6">
          <h2 className="mb-4 font-semibold">Your Classes</h2>
          {classes.length === 0 ? (
            <p className="text-sm text-slate-500">
              No classes yet. <Link to="/teacher/classes" className="text-indigo-600 hover:underline">Create a class</Link> to get started.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {classes.map((c) => (
                <Link key={c.id} to="/teacher/classes" className="rounded-xl border border-slate-200 p-4 transition hover:border-indigo-300 dark:border-slate-700 dark:hover:border-indigo-700">
                  <p className="font-semibold text-slate-900 dark:text-white">{c.name}</p>
                  <p className="text-sm text-indigo-600">{c.code}</p>
                  {c.course && (
                    <p className="mt-1 text-xs text-slate-500">
                      {c.course.department?.code} → {c.course.code}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-500">{c.enrollments?.[0]?.count || 0} students</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

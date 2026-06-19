import { useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { HiOutlineUserGroup, HiOutlineOfficeBuilding, HiOutlineAcademicCap, HiOutlineLibrary } from 'react-icons/hi'
import { useInstitutionStore } from '../../stores/institution'
import StatCard from '../../components/ui/StatCard'

export default function AdminDashboard() {
  const { allUsers, departments, courses, classes, enrollments, loading, fetchAdminData } = useInstitutionStore()

  useEffect(() => { fetchAdminData() }, [fetchAdminData])

  const stats = useMemo(() => ({
    users: allUsers.length,
    teachers: allUsers.filter((u) => u.role === 'teacher').length,
    students: allUsers.filter((u) => u.role === 'student').length,
    departments: departments.length,
    courses: courses.length,
    classes: classes.length,
    enrollments: enrollments.length,
  }), [allUsers, departments, courses, classes, enrollments])

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="page-title">Admin Dashboard</h1>
        <p className="page-subtitle">Manage departments, courses, classes, and users</p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={HiOutlineLibrary} label="Departments" value={stats.departments} color="indigo" />
        <StatCard icon={HiOutlineAcademicCap} label="Courses" value={stats.courses} color="purple" />
        <StatCard icon={HiOutlineOfficeBuilding} label="Classes" value={stats.classes} color="rose" />
        <StatCard icon={HiOutlineUserGroup} label="Students" value={stats.students} color="emerald" />
      </div>

      <div className="glass-card p-6">
        <h2 className="mb-4 font-semibold text-slate-900 dark:text-white">Setup Guide</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { step: '1', title: 'Departments', desc: 'Add Engineering, Computer Applications, etc.' },
            { step: '2', title: 'Courses', desc: 'Add BCA, MCA, BTech, MTech under each dept' },
            { step: '3', title: 'Classes', desc: 'Create year/section classes under a course' },
            { step: '4', title: 'Users', desc: 'Assign roles and enroll students in classes' },
          ].map(({ step, title, desc }) => (
            <div key={step} className="rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 p-4 dark:from-indigo-950/30 dark:to-purple-950/30">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500 text-sm font-bold text-white">{step}</span>
              <h3 className="mt-2 font-semibold text-slate-900 dark:text-white">{title}</h3>
              <p className="mt-1 text-sm text-slate-500">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {!loading && (departments.length > 0 || classes.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {departments.length > 0 && (
            <div className="glass-card p-6">
              <h2 className="mb-4 font-semibold">Departments & Courses</h2>
              <div className="space-y-3">
                {departments.map((d) => {
                  const deptCourses = courses.filter((c) => c.department_id === d.id)
                  return (
                    <div key={d.id} className="rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/50">
                      <p className="font-medium text-slate-900 dark:text-white">{d.name} <span className="text-xs text-indigo-600">({d.code})</span></p>
                      <p className="mt-1 text-xs text-slate-500">
                        {deptCourses.length ? deptCourses.map((c) => c.code).join(', ') : 'No courses yet'}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {classes.length > 0 && (
            <div className="glass-card p-6">
              <h2 className="mb-4 font-semibold">Recent Classes</h2>
              <div className="space-y-2">
                {classes.slice(0, 5).map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/50">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">{c.name}</p>
                      <p className="text-xs text-slate-500">
                        {c.course?.department?.code} → {c.course?.code || '—'} · {c.code}
                      </p>
                    </div>
                    <span className="text-xs text-indigo-600">{c.teacher?.name || 'No teacher'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

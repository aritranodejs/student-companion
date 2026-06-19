import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { HiOutlineAcademicCap } from 'react-icons/hi'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { useDataStore } from '../stores'
import { calcGPA, calcCGPA } from '../utils/helpers'
import EmptyState from '../components/ui/EmptyState'
import StatCard from '../components/ui/StatCard'

export default function CGPAPage() {
  const { semesters, loading } = useDataStore()

  const stats = useMemo(() => {
    const cgpa = calcCGPA(semesters)
    const bestGpa = semesters.length ? Math.max(...semesters.map((s) => s.gpa || 0)) : 0
    const totalCredits = semesters.reduce((sum, s) => sum + (s.subjects || []).reduce((cs, sub) => cs + sub.credits, 0), 0)
    return { cgpa, bestGpa, totalCredits, totalSemesters: semesters.length }
  }, [semesters])

  const chartData = useMemo(() =>
    semesters.map((s) => ({ name: s.semester_name, gpa: s.gpa || 0 })),
    [semesters]
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">CGPA & Grades</h1>
        <p className="page-subtitle">View grades published by your teachers — read only</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={HiOutlineAcademicCap} label="Current CGPA" value={stats.cgpa || '—'} color="indigo" />
        <StatCard icon={HiOutlineAcademicCap} label="Best GPA" value={stats.bestGpa || '—'} color="emerald" />
        <StatCard icon={HiOutlineAcademicCap} label="Total Credits" value={stats.totalCredits} color="amber" />
        <StatCard icon={HiOutlineAcademicCap} label="Semesters" value={stats.totalSemesters} color="rose" />
      </div>

      {semesters.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="glass-card p-5">
            <h2 className="mb-4 text-sm font-semibold">Semester Performance</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="gpa" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="glass-card p-5">
            <h2 className="mb-4 text-sm font-semibold">CGPA Progress</h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="gpa" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {loading ? (
        <div className="skeleton h-32 w-full rounded-2xl" />
      ) : semesters.length === 0 ? (
        <EmptyState title="No grades published yet" description="Your teacher will publish semester grades here when results are ready." />
      ) : (
        <div className="space-y-4">
          {semesters.map((sem) => (
            <motion.div key={sem.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card overflow-hidden">
              <div className="p-5">
                <h3 className="font-semibold text-slate-900 dark:text-white">{sem.semester_name}</h3>
                <p className="text-sm text-slate-500">GPA: {sem.gpa || 0} · {(sem.subjects || []).length} subjects</p>
              </div>
              {(sem.subjects || []).length > 0 && (
                <div className="border-t border-slate-200 px-5 py-3 dark:border-slate-800">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500">
                        <th className="pb-2">Subject</th>
                        <th className="pb-2">Credits</th>
                        <th className="pb-2">Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(sem.subjects || []).map((sub) => (
                        <tr key={sub.id} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="py-2 text-slate-900 dark:text-white">{sub.subject_name}</td>
                          <td className="py-2 text-slate-500">{sub.credits}</td>
                          <td className="py-2"><span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-600 dark:bg-indigo-950/30">{sub.grade}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

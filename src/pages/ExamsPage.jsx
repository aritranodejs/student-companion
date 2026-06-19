import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { useDataStore } from '../stores'
import { daysUntil } from '../utils/helpers'
import EmptyState from '../components/ui/EmptyState'

export default function ExamsPage() {
  const { exams, loading } = useDataStore()

  const sorted = useMemo(() =>
    [...exams].sort((a, b) => new Date(a.exam_date) - new Date(b.exam_date)),
    [exams]
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Exams</h1>
        <p className="page-subtitle">Upcoming exams scheduled by your teachers</p>
      </div>

      {loading ? (
        <div className="skeleton h-32 w-full rounded-2xl" />
      ) : sorted.length === 0 ? (
        <EmptyState title="No exams scheduled" description="Teachers will post exam dates for your classes here." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((exam, i) => {
            const days = daysUntil(exam.exam_date)
            const isPast = days < 0
            return (
              <motion.div
                key={exam.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`glass-card-hover p-5 ${isPast ? 'opacity-60' : ''}`}
              >
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-600 dark:bg-rose-950/30">From Teacher</span>
                <h3 className="mt-2 font-semibold text-slate-900 dark:text-white">{exam.exam_name}</h3>
                <p className="text-sm text-slate-500">{exam.subject}</p>
                <p className="mt-2 text-sm font-medium text-indigo-600">{format(new Date(exam.exam_date), 'EEEE, MMM d, yyyy')}</p>
                {!isPast ? (
                  <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{days} <span className="text-sm font-normal text-slate-500">days left</span></p>
                ) : (
                  <p className="mt-1 text-sm text-slate-400">Completed</p>
                )}
                {exam.notes && <p className="mt-2 text-xs text-slate-500">{exam.notes}</p>}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

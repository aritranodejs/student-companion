import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { HiOutlineDocumentText, HiOutlinePaperClip } from 'react-icons/hi'
import { useAuthStore, useDataStore } from '../stores'
import { daysUntil, getPriorityColor, getStatusColor } from '../utils/helpers'
import { ASSIGNMENT_STATUSES } from '../constants'
import SearchInput from '../components/ui/SearchInput'
import EmptyState from '../components/ui/EmptyState'
import { TableSkeleton } from '../components/ui/Skeleton'
import AssignmentDetail from '../components/assignments/AssignmentDetail'

export default function AssignmentsPage() {
  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const { assignments, submissions, loading } = useDataStore()
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const teacherAssignments = useMemo(
    () => assignments.filter((a) => a.fromTeacher || a.class_id),
    [assignments]
  )

  const subMap = useMemo(
    () => Object.fromEntries((submissions || []).map((s) => [s.assignment_id, s])),
    [submissions]
  )

  const filtered = useMemo(() => {
    let items = teacherAssignments.filter((a) =>
      (a.title.toLowerCase().includes(search.toLowerCase()) ||
       a.subject.toLowerCase().includes(search.toLowerCase())) &&
      (statusFilter === 'all' || (subMap[a.id]?.status || a.status) === statusFilter)
    )
    return items.sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
  }, [teacherAssignments, search, statusFilter, subMap])

  const stats = useMemo(() => ({
    overdue: teacherAssignments.filter((a) => (subMap[a.id]?.status || a.status) !== 'completed' && daysUntil(a.due_date) < 0).length,
    thisWeek: teacherAssignments.filter((a) => {
      const d = daysUntil(a.due_date)
      return (subMap[a.id]?.status || a.status) !== 'completed' && d >= 0 && d <= 7
    }).length,
    pending: teacherAssignments.filter((a) => (subMap[a.id]?.status || a.status) !== 'completed').length,
  }), [teacherAssignments, subMap])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Assignments</h1>
        <p className="page-subtitle">View teacher assignments, upload your work, and join the discussion</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-red-500">{stats.overdue}</p>
          <p className="text-xs text-slate-500">Overdue</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-amber-500">{stats.thisWeek}</p>
          <p className="text-xs text-slate-500">Due This Week</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-indigo-500">{stats.pending}</p>
          <p className="text-xs text-slate-500">Pending</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1"><SearchInput value={search} onChange={setSearch} placeholder="Search assignments..." /></div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field w-auto">
          <option value="all">All Status</option>
          {ASSIGNMENT_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No assignments yet"
          description="Your teachers will post assignments here. You'll be notified when new work is assigned."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((item, i) => {
            const sub = subMap[item.id]
            const status = sub?.status || item.status
            return (
              <motion.button
                key={item.id}
                type="button"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => setSelected(item)}
                className="glass-card-hover flex w-full flex-col gap-3 p-4 text-left sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className={`font-semibold ${status === 'completed' ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                      {item.title}
                    </h3>
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-600 dark:bg-purple-950/30">From Teacher</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getPriorityColor(item.priority)}`}>{item.priority}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(status)}`}>{status.replace('_', ' ')}</span>
                  </div>
                  <p className="text-sm text-slate-500">{item.subject} · Due {format(new Date(item.due_date), 'MMM d, yyyy')}</p>
                  {sub?.file_name && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600"><HiOutlinePaperClip /> Submitted: {sub.file_name}</p>
                  )}
                  {sub?.teacher_feedback && (
                    <p className="mt-1 text-xs text-indigo-600">Teacher left feedback</p>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-indigo-600">
                  <HiOutlineDocumentText className="h-5 w-5" />
                  Open
                  {status !== 'completed' && (
                    <span className={`text-xs ${daysUntil(item.due_date) < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                      {daysUntil(item.due_date) < 0 ? `${Math.abs(daysUntil(item.due_date))}d overdue` : `${daysUntil(item.due_date)}d left`}
                    </span>
                  )}
                </div>
              </motion.button>
            )
          })}
        </div>
      )}

      {selected && (
        <AssignmentDetail
          assignment={selected}
          userId={user.id}
          profile={profile}
          onClose={() => setSelected(null)}
          onUpdated={() => useDataStore.getState().fetchAll(user.id, 'student')}
        />
      )}
    </div>
  )
}

import { useMemo } from 'react'
import { format } from 'date-fns'
import { HiOutlineCamera, HiOutlineLocationMarker } from 'react-icons/hi'
import { Avatar } from './StudentIdentityCard'

const STATUS_STYLE = {
  present: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  late: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  absent: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  excused: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}

function CellBadge({ log }) {
  if (!log) return <span className="text-slate-300">—</span>
  const label = log.status === 'present' ? 'P' : log.status === 'absent' ? 'A' : log.status === 'late' ? 'L' : 'E'
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${STATUS_STYLE[log.status] || STATUS_STYLE.excused}`}>
        {label}
      </span>
      <span className="flex gap-0.5 text-[9px] text-slate-400">
        {log.face_verified && <HiOutlineCamera title="Face verified" />}
        {log.location_verified && <HiOutlineLocationMarker title="GPS verified" />}
        {log.method === 'manual' && <span title="Manual">M</span>}
      </span>
    </div>
  )
}

export default function AttendanceHistoryGrid({ students, logs, sessions }) {
  const dates = useMemo(() => {
    const set = new Set()
    sessions.forEach((s) => set.add(s.session_date))
    logs.forEach((l) => {
      const d = l.session?.session_date || l.marked_at?.split('T')[0]
      if (d) set.add(d)
    })
    return [...set].sort().reverse().slice(0, 14)
  }, [logs, sessions])

  const logMap = useMemo(() => {
    const map = {}
    logs.forEach((l) => {
      const date = l.session?.session_date || l.marked_at?.split('T')[0]
      if (date) map[`${l.student_id}:${date}`] = l
    })
    return map
  }, [logs])

  if (!students.length) {
    return <p className="py-8 text-center text-sm text-slate-500">No enrolled students.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/50 text-left text-xs uppercase text-slate-500 dark:border-slate-800">
            <th className="sticky left-0 z-10 bg-slate-50/95 px-4 py-3 dark:bg-slate-900/95">Student</th>
            {dates.map((d) => (
              <th key={d} className="px-2 py-3 text-center whitespace-nowrap">{format(new Date(d + 'T12:00:00'), 'MMM d')}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map(({ student_id, student }) => (
            <tr key={student_id} className="border-b border-slate-100 dark:border-slate-800">
              <td className="sticky left-0 z-10 bg-white px-4 py-3 dark:bg-slate-900">
                <div className="flex items-center gap-2">
                  <Avatar url={student?.avatar_url} name={student?.name} size="sm" />
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{student?.name}</p>
                    <p className="text-xs text-slate-400">{student?.roll_number || '—'}</p>
                  </div>
                </div>
              </td>
              {dates.map((d) => (
                <td key={d} className="px-2 py-3 text-center">
                  <CellBadge log={logMap[`${student_id}:${d}`]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-slate-500">P = Present · A = Absent · L = Late · M = Manual · icons = face/GPS verified</p>
    </div>
  )
}

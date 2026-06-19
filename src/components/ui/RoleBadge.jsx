export default function RoleBadge({ role, compact = false }) {
  const labels = { admin: 'Admin', teacher: 'Teacher', student: 'Student' }
  const colors = {
    admin: 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-rose-500/30',
    teacher: 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-indigo-500/30',
    student: 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-emerald-500/30',
  }
  return (
    <span className={`inline-flex items-center rounded-full font-semibold shadow-sm ${colors[role] || colors.student} ${compact ? 'px-1.5 py-0 text-[10px]' : 'px-2.5 py-0.5 text-xs'}`}>
      {labels[role] || role}
    </span>
  )
}

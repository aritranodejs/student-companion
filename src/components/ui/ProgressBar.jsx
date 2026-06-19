export default function ProgressBar({ value, max = 100, color = 'indigo', showLabel = true, size = 'md' }) {
  const percent = Math.min(100, Math.round((value / max) * 100))
  const heights = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-4' }
  const colorClasses = {
    indigo: 'bg-gradient-to-r from-indigo-500 to-purple-600',
    emerald: 'bg-gradient-to-r from-emerald-500 to-teal-600',
    amber: 'bg-gradient-to-r from-amber-500 to-orange-600',
    red: 'bg-gradient-to-r from-red-500 to-rose-600',
  }

  return (
    <div>
      {showLabel && (
        <div className="mb-1 flex justify-between text-xs text-slate-500">
          <span>{value} / {max}</span>
          <span>{percent}%</span>
        </div>
      )}
      <div className={`w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700 ${heights[size]}`}>
        <div
          className={`${heights[size]} rounded-full transition-all duration-500 ${colorClasses[color]}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

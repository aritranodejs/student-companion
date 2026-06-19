import { motion } from 'framer-motion'

export default function StatCard({ icon: Icon, label, value, subtitle, color = 'indigo', trend, delay = 0 }) {
  const colors = {
    indigo: 'from-indigo-500 to-purple-600 shadow-indigo-500/25',
    emerald: 'from-emerald-500 to-teal-600 shadow-emerald-500/25',
    amber: 'from-amber-500 to-orange-600 shadow-amber-500/25',
    rose: 'from-rose-500 to-pink-600 shadow-rose-500/25',
  }

  const glow = {
    indigo: 'group-hover:shadow-indigo-500/10',
    emerald: 'group-hover:shadow-emerald-500/10',
    amber: 'group-hover:shadow-amber-500/10',
    rose: 'group-hover:shadow-rose-500/10',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`group glass-card-hover p-5 transition-shadow duration-300 ${glow[color]}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</p>
          {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
          {trend && (
            <p className={`mt-1 text-xs font-medium ${trend > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </p>
          )}
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${colors[color]} text-white shadow-lg transition-transform duration-300 group-hover:scale-110`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  )
}

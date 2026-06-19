import { motion } from 'framer-motion'
import { HiInbox } from 'react-icons/hi'

export default function EmptyState({ icon: Icon = HiInbox, title, description, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-14 text-center"
    >
      <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-500 dark:from-indigo-950/60 dark:to-purple-950/60 dark:text-indigo-400">
        <Icon className="h-8 w-8" />
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/40 to-transparent dark:from-white/5" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  )
}

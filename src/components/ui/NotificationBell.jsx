import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { HiOutlineBell } from 'react-icons/hi'
import { formatDistanceToNow } from 'date-fns'
import { useAuthStore, useNotificationStore } from '../../stores'
import { NOTIFICATION_ICONS, NOTIFICATION_COLORS } from '../../lib/notify.jsx'

export default function NotificationBell() {
  const user = useAuthStore((s) => s.user)
  const { notifications, unreadCount, fetchNotifications, markRead, markAllRead, subscribe } = useNotificationStore()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (user?.id) {
      fetchNotifications(user.id)
      const unsub = subscribe(user.id)
      return unsub
    }
  }, [user?.id, fetchNotifications, subscribe])

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
        aria-expanded={open}
        className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-200 ${
          open
            ? 'border-indigo-400 bg-indigo-50 text-indigo-600 shadow-md shadow-indigo-500/20 dark:border-indigo-500 dark:bg-indigo-950/60 dark:text-indigo-400'
            : 'border-slate-200/80 bg-white/80 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:border-indigo-600 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-400'
        }`}
      >
        <HiOutlineBell className={`h-5 w-5 transition-transform duration-200 ${open ? 'scale-110' : ''}`} />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-pink-600 px-1 text-[10px] font-bold text-white shadow-lg shadow-rose-500/40 ring-2 ring-white dark:ring-slate-900"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="absolute right-0 z-50 mt-2 w-80 origin-top-right overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-2xl shadow-slate-900/10 backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/95 dark:shadow-black/40 sm:w-96"
          >
            <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 px-4 py-3.5 dark:border-slate-800 dark:from-indigo-950/30 dark:to-purple-950/30">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Notifications</h3>
                {unreadCount > 0 && (
                  <p className="text-xs text-slate-500">{unreadCount} unread</p>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead(user.id)}
                  className="rounded-lg bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-700 transition hover:bg-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto overscroll-contain">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                    <HiOutlineBell className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-500">All caught up!</p>
                  <p className="mt-0.5 text-xs text-slate-400">No notifications yet</p>
                </div>
              ) : (
                notifications.map((n, i) => {
                  const Icon = NOTIFICATION_ICONS[n.type] || NOTIFICATION_ICONS.info
                  return (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <Link
                        to={n.link || '#'}
                        onClick={() => { markRead(n.id); setOpen(false) }}
                        className={`flex gap-3 border-b border-slate-50 px-4 py-3.5 transition-colors duration-150 hover:bg-slate-50 dark:border-slate-800/80 dark:hover:bg-slate-800/50 ${!n.read ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''}`}
                      >
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${NOTIFICATION_COLORS[n.type] || NOTIFICATION_COLORS.info}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{n.title}</p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.message}</p>
                          <p className="mt-1 text-[10px] text-slate-400">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        {!n.read && (
                          <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-indigo-500 shadow-sm shadow-indigo-500/50" />
                        )}
                      </Link>
                    </motion.div>
                  )
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

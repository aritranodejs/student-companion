import { useState } from 'react'
import { motion } from 'framer-motion'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import SupabaseBanner from '../ui/SupabaseBanner'

export default function AppLayout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="relative flex min-h-screen overflow-hidden">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl dark:bg-indigo-600/15" />
        <div className="absolute -right-32 top-1/3 h-96 w-96 rounded-full bg-purple-500/10 blur-3xl dark:bg-purple-600/15" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-emerald-500/5 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-indigo-50/20 to-purple-50/20 dark:from-slate-950 dark:via-indigo-950/10 dark:to-purple-950/10" />
      </div>

      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <div className="flex min-w-0 flex-1 flex-col">
        <SupabaseBanner />
        <TopBar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-auto">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="p-4 lg:p-8"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  )
}

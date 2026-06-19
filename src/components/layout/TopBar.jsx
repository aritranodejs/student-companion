import { Link } from 'react-router-dom'
import { HiOutlineSun, HiOutlineMoon, HiOutlineMenu } from 'react-icons/hi'
import { useAuthStore, useThemeStore } from '../../stores'
import NotificationBell from '../ui/NotificationBell'
import RoleBadge from '../ui/RoleBadge'

export default function TopBar({ onMenuClick }) {
  const profile = useAuthStore((s) => s.profile)
  const { theme, toggleTheme } = useThemeStore()

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/60 bg-white/70 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-950/70">
      <div className="flex h-16 items-center justify-between gap-4 px-4 lg:px-8">
        {/* Mobile menu */}
        <button
          onClick={onMenuClick}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-white/80 text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/40 lg:hidden"
          aria-label="Open menu"
        >
          <HiOutlineMenu className="h-5 w-5" />
        </button>

        {/* Spacer on desktop — sidebar handles branding */}
        <div className="hidden flex-1 lg:block" />

        {/* Right actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={toggleTheme}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-white/80 text-slate-600 transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:border-indigo-600 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-400"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <HiOutlineSun className="h-5 w-5" /> : <HiOutlineMoon className="h-5 w-5" />}
          </button>

          <NotificationBell />

          <Link
            to="/profile"
            className="hidden items-center gap-3 rounded-xl border border-slate-200/80 bg-white/80 py-1.5 pl-1.5 pr-3 transition-all duration-200 hover:border-indigo-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800/80 dark:hover:border-indigo-600 sm:flex"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white shadow-md shadow-indigo-500/30">
              {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 text-left">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{profile?.name?.split(' ')[0]}</p>
              <RoleBadge role={profile?.role || 'student'} compact />
            </div>
          </Link>
        </div>
      </div>
    </header>
  )
}

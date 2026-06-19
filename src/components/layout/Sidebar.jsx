import { NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  HiOutlineViewGrid,
  HiOutlineClipboardCheck,
  HiOutlineDocumentText,
  HiOutlineAcademicCap,
  HiOutlineClock,
  HiOutlineCalendar,
  HiOutlineFlag,
  HiOutlineUser,
  HiOutlineCog,
  HiOutlineLogout,
  HiOutlineX,
  HiOutlineUserGroup,
  HiOutlineOfficeBuilding,
  HiOutlineLibrary,
  HiOutlineBookOpen,
} from 'react-icons/hi'
import { useAuthStore } from '../../stores'
import { getNavForRole } from '../../constants/roles'
import RoleBadge from '../ui/RoleBadge'

const iconMap = {
  dashboard: HiOutlineViewGrid,
  attendance: HiOutlineClipboardCheck,
  assignments: HiOutlineDocumentText,
  cgpa: HiOutlineAcademicCap,
  study: HiOutlineClock,
  exams: HiOutlineCalendar,
  goals: HiOutlineFlag,
  profile: HiOutlineUser,
  settings: HiOutlineCog,
  users: HiOutlineUserGroup,
  classes: HiOutlineOfficeBuilding,
  departments: HiOutlineLibrary,
  courses: HiOutlineBookOpen,
}

function SidebarContent({ onNavigate }) {
  const navigate = useNavigate()
  const { signOut, profile } = useAuthStore()
  const navItems = getNavForRole(profile?.role || 'student')

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-lg font-bold text-white shadow-lg shadow-indigo-500/40">
          SC
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 to-transparent" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">Student Companion</h1>
          <RoleBadge role={profile?.role || 'student'} />
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {navItems.map(({ path, label, icon }) => {
          const Icon = iconMap[icon]
          return (
            <NavLink
              key={path}
              to={path}
              end={path === '/' || path === '/admin' || path === '/teacher'}
              onClick={onNavigate}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-500/15 to-purple-500/10 text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-200'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="nav-indicator"
                      className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-indigo-500 to-purple-600"
                    />
                  )}
                  <Icon className={`h-5 w-5 transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`} />
                  {label}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="border-t border-slate-200/80 p-4 dark:border-slate-800">
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-slate-50/80 px-3 py-2.5 dark:bg-slate-800/50">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-sm font-semibold text-white shadow-md">
            {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{profile?.name || 'User'}</p>
            <p className="truncate text-xs text-slate-500">{profile?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
        >
          <HiOutlineLogout className="h-5 w-5" />
          Logout
        </button>
      </div>
    </div>
  )
}

export default function Sidebar({ mobileOpen, setMobileOpen }) {
  return (
    <>
      <aside className="hidden w-64 shrink-0 border-r border-slate-200/60 bg-white/60 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/60 lg:block">
        <SidebarContent />
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="fixed inset-y-0 left-0 z-50 w-64 border-r border-slate-200/60 bg-white/95 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95 lg:hidden"
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <HiOutlineX className="h-5 w-5" />
              </button>
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

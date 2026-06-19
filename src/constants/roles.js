export const ROLES = {
  ADMIN: 'admin',
  TEACHER: 'teacher',
  STUDENT: 'student',
}

export const ROLE_LABELS = {
  admin: 'Administrator',
  teacher: 'Teacher',
  student: 'Student',
}

export const ROLE_COLORS = {
  admin: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
  teacher: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300',
  student: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
}

export const ADMIN_NAV = [
  { path: '/admin', label: 'Dashboard', icon: 'dashboard' },
  { path: '/admin/departments', label: 'Departments', icon: 'departments' },
  { path: '/admin/courses', label: 'Courses', icon: 'courses' },
  { path: '/admin/classes', label: 'Classes', icon: 'classes' },
  { path: '/admin/attendance', label: 'Attendance', icon: 'attendance' },
  { path: '/admin/users', label: 'Users', icon: 'users' },
  { path: '/profile', label: 'Profile', icon: 'profile' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
]

export const TEACHER_NAV = [
  { path: '/teacher', label: 'Dashboard', icon: 'dashboard' },
  { path: '/teacher/classes', label: 'My Classes', icon: 'classes' },
  { path: '/teacher/assignments', label: 'Assignments', icon: 'assignments' },
  { path: '/teacher/grades', label: 'Grades', icon: 'cgpa' },
  { path: '/teacher/attendance', label: 'Attendance', icon: 'attendance' },
  { path: '/teacher/exams', label: 'Exams', icon: 'exams' },
  { path: '/profile', label: 'Profile', icon: 'profile' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
]

export const STUDENT_NAV = [
  { path: '/', label: 'Dashboard', icon: 'dashboard' },
  { path: '/attendance', label: 'Attendance', icon: 'attendance' },
  { path: '/assignments', label: 'Assignments', icon: 'assignments' },
  { path: '/cgpa', label: 'My Grades', icon: 'cgpa' },
  { path: '/study', label: 'Study Timer', icon: 'study' },
  { path: '/exams', label: 'Exams', icon: 'exams' },
  { path: '/goals', label: 'Goals', icon: 'goals' },
  { path: '/profile', label: 'Profile', icon: 'profile' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
]

export function getNavForRole(role) {
  if (role === ROLES.ADMIN) return ADMIN_NAV
  if (role === ROLES.TEACHER) return TEACHER_NAV
  return STUDENT_NAV
}

export function getHomeForRole(role) {
  if (role === ROLES.ADMIN) return '/admin'
  if (role === ROLES.TEACHER) return '/teacher'
  return '/'
}

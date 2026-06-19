export const GRADE_POINTS = {
  O: 10,
  'A+': 9,
  A: 8,
  'B+': 7,
  B: 6,
  C: 5,
  D: 4,
  F: 0,
}

export const GRADES = Object.keys(GRADE_POINTS)

export const PRIORITIES = ['low', 'medium', 'high']

export const ASSIGNMENT_STATUSES = ['pending', 'in_progress', 'completed']

export const ATTENDANCE_THRESHOLD = 75

export const MOTIVATIONAL_QUOTES = [
  'Success is the sum of small efforts repeated day in and day out.',
  'The expert in anything was once a beginner.',
  'Don\'t watch the clock; do what it does. Keep going.',
  'Education is the passport to the future.',
  'The beautiful thing about learning is that nobody can take it away from you.',
  'Strive for progress, not perfection.',
  'Your limitation—it\'s only your imagination.',
  'Push yourself, because no one else is going to do it for you.',
  'Great things never come from comfort zones.',
  'Dream it. Wish it. Do it.',
]

export const BADGE_DEFINITIONS = {
  first_assignment: { label: 'First Assignment Completed', icon: '📝' },
  study_streak_7: { label: '7 Day Study Streak', icon: '🔥' },
  study_streak_30: { label: '30 Day Study Streak', icon: '⭐' },
  attendance_champion: { label: 'Attendance Champion', icon: '🏆' },
  cgpa_excellence: { label: 'CGPA Excellence', icon: '🎓' },
}

export const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: 'dashboard' },
  { path: '/attendance', label: 'Attendance', icon: 'attendance' },
  { path: '/assignments', label: 'Assignments', icon: 'assignments' },
  { path: '/cgpa', label: 'CGPA', icon: 'cgpa' },
  { path: '/study', label: 'Study Timer', icon: 'study' },
  { path: '/exams', label: 'Exams', icon: 'exams' },
  { path: '/goals', label: 'Goals', icon: 'goals' },
  { path: '/profile', label: 'Profile', icon: 'profile' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
]

export const TIMER_MODES = {
  pomodoro: { focus: 25 * 60, break: 5 * 60, label: 'Pomodoro' },
  extended: { focus: 50 * 60, break: 10 * 60, label: 'Extended Focus' },
  custom: { focus: 25 * 60, break: 5 * 60, label: 'Custom' },
}

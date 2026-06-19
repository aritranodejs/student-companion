import { GRADE_POINTS, ATTENDANCE_THRESHOLD } from '../constants'

export function calcAttendancePercent(attended, total) {
  if (!total || total === 0) return 0
  return Math.round((attended / total) * 100 * 100) / 100
}

export function classesNeededFor75(attended, total) {
  const current = calcAttendancePercent(attended, total)
  if (current >= ATTENDANCE_THRESHOLD) return 0
  const needed = Math.ceil((ATTENDANCE_THRESHOLD * total - 100 * attended) / (100 - ATTENDANCE_THRESHOLD))
  return Math.max(0, needed)
}

export function classesAllowedToMiss(attended, total) {
  const current = calcAttendancePercent(attended, total)
  if (current < ATTENDANCE_THRESHOLD) return 0
  const allowed = Math.floor((100 * attended - ATTENDANCE_THRESHOLD * total) / ATTENDANCE_THRESHOLD)
  return Math.max(0, allowed)
}

export function getAttendanceColor(percent) {
  if (percent >= ATTENDANCE_THRESHOLD) return 'green'
  if (percent >= 65) return 'yellow'
  return 'red'
}

export function calcGPA(subjects) {
  if (!subjects?.length) return 0
  let totalPoints = 0
  let totalCredits = 0
  subjects.forEach(({ credits, grade }) => {
    const points = GRADE_POINTS[grade] ?? 0
    totalPoints += points * credits
    totalCredits += credits
  })
  if (totalCredits === 0) return 0
  return Math.round((totalPoints / totalCredits) * 100) / 100
}

export function calcCGPA(semesters) {
  if (!semesters?.length) return 0
  const valid = semesters.filter((s) => s.gpa > 0)
  if (!valid.length) return 0
  const sum = valid.reduce((acc, s) => acc + s.gpa, 0)
  return Math.round((sum / valid.length) * 100) / 100
}

export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function formatHours(seconds) {
  return (seconds / 3600).toFixed(1)
}

export function daysUntil(dateStr) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24))
  return diff
}

export function getRandomQuote(quotes) {
  return quotes[Math.floor(Math.random() * quotes.length)]
}

export function calcStudyStreak(sessions) {
  if (!sessions?.length) return { current: 0, longest: 0 }

  const dates = [...new Set(sessions.map((s) => s.session_date))].sort()
  if (!dates.length) return { current: 0, longest: 0 }

  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  let current = 0
  let longest = 0
  let streak = 1

  if (dates.includes(today) || dates.includes(yesterday)) {
    const startDate = dates.includes(today) ? today : yesterday
    current = 1
    let checkDate = new Date(startDate)
    checkDate.setDate(checkDate.getDate() - 1)
    while (dates.includes(checkDate.toISOString().split('T')[0])) {
      current++
      checkDate.setDate(checkDate.getDate() - 1)
    }
  }

  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1])
    const curr = new Date(dates[i])
    const diff = (curr - prev) / (1000 * 60 * 60 * 24)
    if (diff === 1) {
      streak++
    } else {
      longest = Math.max(longest, streak)
      streak = 1
    }
  }
  longest = Math.max(longest, streak, current)

  return { current, longest }
}

export function exportToCSV(data, filename) {
  if (!data?.length) return
  const headers = Object.keys(data[0])
  const rows = data.map((row) =>
    headers.map((h) => {
      const val = row[h] ?? ''
      return `"${String(val).replace(/"/g, '""')}"`
    }).join(',')
  )
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function parseCSV(text) {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map((line) => {
    const values = line.match(/(".*?"|[^,]+)/g) || []
    const obj = {}
    headers.forEach((h, i) => {
      obj[h] = (values[i] || '').trim().replace(/^"|"$/g, '')
    })
    return obj
  })
}

export function getPriorityColor(priority) {
  switch (priority) {
    case 'high': return 'text-red-500 bg-red-50 dark:bg-red-950/30'
    case 'medium': return 'text-amber-500 bg-amber-50 dark:bg-amber-950/30'
    default: return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
  }
}

export function getStatusColor(status) {
  switch (status) {
    case 'completed': return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
    case 'in_progress': return 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
    default: return 'text-slate-500 bg-slate-50 dark:bg-slate-800/30'
  }
}

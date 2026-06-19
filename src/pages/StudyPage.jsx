import { useMemo, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { HiOutlinePlay, HiOutlinePause, HiOutlineRefresh } from 'react-icons/hi'
import { useAuthStore, useDataStore, useTimerStore } from '../stores'
import { formatDuration, calcStudyStreak, formatHours } from '../utils/helpers'
import { TIMER_MODES } from '../constants'
import StatCard from '../components/ui/StatCard'
import { HiOutlineClock, HiOutlineFire } from 'react-icons/hi'

export default function StudyPage() {
  const user = useAuthStore((s) => s.user)
  const { studySessions, addStudySession, awardBadge } = useDataStore()
  const {
    mode, customFocus, customBreak, timeLeft, isRunning, isBreak,
    setMode, setCustomTimes, start, pause, reset,
  } = useTimerStore()
  const sessionStartRef = useRef(null)

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    const todaySeconds = studySessions.filter((s) => s.session_date === today).reduce((sum, s) => sum + s.duration, 0)

    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const weekSeconds = studySessions.filter((s) => new Date(s.session_date) >= weekAgo).reduce((sum, s) => sum + s.duration, 0)

    const monthAgo = new Date()
    monthAgo.setMonth(monthAgo.getMonth() - 1)
    const monthSeconds = studySessions.filter((s) => new Date(s.session_date) >= monthAgo).reduce((sum, s) => sum + s.duration, 0)

    const totalSeconds = studySessions.reduce((sum, s) => sum + s.duration, 0)
    const streak = calcStudyStreak(studySessions)

    return { todaySeconds, weekSeconds, monthSeconds, totalSeconds, streak }
  }, [studySessions])

  useEffect(() => {
    if (isRunning && !isBreak && !sessionStartRef.current) {
      sessionStartRef.current = Date.now()
    }
  }, [isRunning, isBreak])

  const handleStartPause = () => {
    if (isRunning) pause()
    else start()
  }

  const handleReset = async () => {
    if (sessionStartRef.current && !isBreak) {
      const elapsed = Math.floor((Date.now() - sessionStartRef.current) / 1000)
      if (elapsed >= 60) {
        await addStudySession({ duration: elapsed, session_date: new Date().toISOString().split('T')[0] }, user.id)
        toast.success(`Logged ${formatDuration(elapsed)} of study time!`)
        const { current } = calcStudyStreak([...studySessions, { session_date: new Date().toISOString().split('T')[0] }])
        if (current >= 7) await awardBadge('study_streak_7', user.id)
        if (current >= 30) await awardBadge('study_streak_30', user.id)
      }
    }
    sessionStartRef.current = null
    reset()
  }

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const totalTime = mode === 'custom' ? customFocus * 60 : mode === 'extended' ? 50 * 60 : 25 * 60
  const progress = ((totalTime - timeLeft) / totalTime) * 100

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Study Timer</h1>
        <p className="page-subtitle">Focus with Pomodoro or custom study sessions</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={HiOutlineClock} label="Today" value={formatHours(stats.todaySeconds) + 'h'} color="indigo" />
        <StatCard icon={HiOutlineClock} label="This Week" value={formatHours(stats.weekSeconds) + 'h'} color="emerald" />
        <StatCard icon={HiOutlineClock} label="This Month" value={formatHours(stats.monthSeconds) + 'h'} color="amber" />
        <StatCard icon={HiOutlineClock} label="Total" value={formatHours(stats.totalSeconds) + 'h'} color="rose" />
        <StatCard icon={HiOutlineFire} label="Current Streak" value={`${stats.streak.current} days`} color="indigo" />
        <StatCard icon={HiOutlineFire} label="Longest Streak" value={`${stats.streak.longest} days`} color="emerald" />
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.entries(TIMER_MODES).map(([key, { label }]) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
              mode === key
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'custom' && (
        <div className="glass-card flex flex-wrap gap-4 p-4">
          <div>
            <label className="label-text">Focus (minutes)</label>
            <input
              type="number" min="1" max="120" value={customFocus}
              onChange={(e) => setCustomTimes(Number(e.target.value), customBreak)}
              className="input-field w-24"
            />
          </div>
          <div>
            <label className="label-text">Break (minutes)</label>
            <input
              type="number" min="1" max="30" value={customBreak}
              onChange={(e) => setCustomTimes(customFocus, Number(e.target.value))}
              className="input-field w-24"
            />
          </div>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card mx-auto flex max-w-md flex-col items-center p-10"
      >
        <p className="mb-2 text-sm font-medium text-slate-500">
          {isBreak ? '☕ Break Time' : '🎯 Focus Time'}
        </p>

        <div className="relative mb-8">
          <svg className="h-56 w-56 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="#e2e8f0" strokeWidth="4" />
            <circle
              cx="50" cy="50" r="45" fill="none"
              stroke={isBreak ? '#10b981' : '#6366f1'}
              strokeWidth="4" strokeLinecap="round"
              strokeDasharray={`${progress * 2.83} 283`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-5xl font-bold tabular-nums text-slate-900 dark:text-white">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
          </div>
        </div>

        <div className="flex gap-4">
          <button onClick={handleStartPause} className="btn-primary px-8">
            {isRunning ? <HiOutlinePause className="h-5 w-5" /> : <HiOutlinePlay className="h-5 w-5" />}
            {isRunning ? 'Pause' : 'Start'}
          </button>
          <button onClick={handleReset} className="btn-secondary px-8">
            <HiOutlineRefresh className="h-5 w-5" /> Reset
          </button>
        </div>
      </motion.div>
    </div>
  )
}

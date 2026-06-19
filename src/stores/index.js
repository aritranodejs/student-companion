import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'

export { useInstitutionStore, useNotificationStore } from './institution'

export const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  loading: true,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        set({ user: session.user })
        await get().fetchProfile(session.user.id)
      }
    } catch (err) {
      console.error('Auth init error:', err)
    } finally {
      set({ loading: false })
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        set({ user: session.user })
        await get().fetchProfile(session.user.id)
      } else {
        set({ user: null, profile: null })
      }
      set({ loading: false })
    })
  },

  fetchProfile: async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (data) set({ profile: data })
  },

  signUp: async (email, password, name) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })
    return { data, error }
  },

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, profile: null })
  },

  resetPassword: async (email) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { data, error }
  },

  updateProfile: async (updates) => {
    const userId = get().user?.id
    if (!userId) return { error: new Error('Not authenticated') }
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()
    if (data) set({ profile: data })
    return { data, error }
  },
}))

export const useThemeStore = create(
  persist(
    (set) => ({
      theme: 'light',
      toggleTheme: () =>
        set((state) => {
          const next = state.theme === 'light' ? 'dark' : 'light'
          document.documentElement.classList.toggle('dark', next === 'dark')
          return { theme: next }
        }),
      setTheme: (theme) => {
        document.documentElement.classList.toggle('dark', theme === 'dark')
        set({ theme })
      },
    }),
    {
      name: 'student-companion-theme',
      onRehydrateStorage: () => (state) => {
        if (state?.theme === 'dark') {
          document.documentElement.classList.add('dark')
        }
      },
    }
  )
)

export const useDataStore = create((set, get) => ({
  attendance: [],
  assignments: [],
  semesters: [],
  studySessions: [],
  exams: [],
  goals: [],
  badges: [],
  submissions: [],
  loading: false,

  fetchAll: async (userId, role = 'student') => {
    if (!userId) return
    set({ loading: true })
    try {
      if (role === 'student') {
        const { data: enrollments } = await supabase
          .from('class_enrollments')
          .select('class_id')
          .eq('student_id', userId)
        const classIds = (enrollments || []).map((e) => e.class_id)

        const classAsnQuery = classIds.length
          ? supabase.from('assignments').select('*').in('class_id', classIds).order('due_date')
          : Promise.resolve({ data: [] })
        const classExmQuery = classIds.length
          ? supabase.from('exams').select('*').in('class_id', classIds).order('exam_date')
          : Promise.resolve({ data: [] })

        const [classAsn, subs, classAtt, sem, study, classExm, gl, bd] = await Promise.all([
          classAsnQuery,
          supabase.from('assignment_submissions').select('*').eq('student_id', userId),
          supabase.from('class_attendance').select('*, class:classes(name, code)').eq('student_id', userId),
          supabase.from('semesters').select('*, subjects(*)').eq('student_id', userId).order('created_at'),
          supabase.from('study_sessions').select('*').eq('user_id', userId).order('session_date', { ascending: false }),
          classExmQuery,
          supabase.from('goals').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
          supabase.from('badges').select('*').eq('user_id', userId),
        ])
        const subMap = Object.fromEntries((subs.data || []).map((s) => [s.assignment_id, s.status]))
        const mergedAssignments = (classAsn.data || []).map((a) => ({
          ...a,
          status: subMap[a.id] || 'pending',
          fromTeacher: true,
        }))
        const mergedAttendance = (classAtt.data || []).map((a) => ({
          id: a.id,
          subject_name: a.class?.name || 'Class',
          total_classes: a.total_classes,
          attended_classes: a.attended_classes,
          fromTeacher: true,
        }))
        set({
          attendance: mergedAttendance,
          assignments: mergedAssignments,
          submissions: subs.data || [],
          semesters: sem.data || [],
          studySessions: study.data || [],
          exams: classExm.data || [],
          goals: gl.data || [],
          badges: bd.data || [],
        })
      } else {
        const [att, asn, sem, study, exm, gl, bd] = await Promise.all([
          supabase.from('attendance').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
          supabase.from('assignments').select('*').eq('user_id', userId).order('due_date'),
          supabase.from('semesters').select('*, subjects(*)').eq('user_id', userId).order('created_at'),
          supabase.from('study_sessions').select('*').eq('user_id', userId).order('session_date', { ascending: false }),
          supabase.from('exams').select('*').eq('user_id', userId).order('exam_date'),
          supabase.from('goals').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
          supabase.from('badges').select('*').eq('user_id', userId),
        ])
        set({
          attendance: att.data || [],
          assignments: asn.data || [],
          semesters: sem.data || [],
          studySessions: study.data || [],
          exams: exm.data || [],
          goals: gl.data || [],
          badges: bd.data || [],
        })
      }
    } catch (err) {
      console.error('Fetch error:', err)
    } finally {
      set({ loading: false })
    }
  },

  // Attendance CRUD
  addAttendance: async (data, userId) => {
    const { data: row, error } = await supabase.from('attendance').insert({ ...data, user_id: userId }).select().single()
    if (row) set({ attendance: [row, ...get().attendance] })
    return { data: row, error }
  },
  updateAttendance: async (id, data) => {
    const { data: row, error } = await supabase.from('attendance').update(data).eq('id', id).select().single()
    if (row) set({ attendance: get().attendance.map((a) => (a.id === id ? row : a)) })
    return { data: row, error }
  },
  deleteAttendance: async (id) => {
    const { error } = await supabase.from('attendance').delete().eq('id', id)
    if (!error) set({ attendance: get().attendance.filter((a) => a.id !== id) })
    return { error }
  },

  // Assignments CRUD
  addAssignment: async (data, userId) => {
    const { data: row, error } = await supabase.from('assignments').insert({ ...data, user_id: userId }).select().single()
    if (row) set({ assignments: [...get().assignments, row].sort((a, b) => new Date(a.due_date) - new Date(b.due_date)) })
    return { data: row, error }
  },
  updateAssignment: async (id, data) => {
    const { data: row, error } = await supabase.from('assignments').update(data).eq('id', id).select().single()
    if (row) set({ assignments: get().assignments.map((a) => (a.id === id ? row : a)) })
    return { data: row, error }
  },
  deleteAssignment: async (id) => {
    const { error } = await supabase.from('assignments').delete().eq('id', id)
    if (!error) set({ assignments: get().assignments.filter((a) => a.id !== id) })
    return { error }
  },

  // Semesters CRUD
  addSemester: async (data, userId) => {
    const { data: row, error } = await supabase.from('semesters').insert({ ...data, user_id: userId }).select('*, subjects(*)').single()
    if (row) set({ semesters: [...get().semesters, row] })
    return { data: row, error }
  },
  updateSemester: async (id, data) => {
    const { data: row, error } = await supabase.from('semesters').update(data).eq('id', id).select('*, subjects(*)').single()
    if (row) set({ semesters: get().semesters.map((s) => (s.id === id ? row : s)) })
    return { data: row, error }
  },
  deleteSemester: async (id) => {
    const { error } = await supabase.from('semesters').delete().eq('id', id)
    if (!error) set({ semesters: get().semesters.filter((s) => s.id !== id) })
    return { error }
  },

  // Subjects CRUD
  addSubject: async (semesterId, data) => {
    const { data: row, error } = await supabase.from('subjects').insert({ ...data, semester_id: semesterId }).select().single()
    if (row) {
      set({
        semesters: get().semesters.map((s) =>
          s.id === semesterId ? { ...s, subjects: [...(s.subjects || []), row] } : s
        ),
      })
    }
    return { data: row, error }
  },
  deleteSubject: async (semesterId, subjectId) => {
    const { error } = await supabase.from('subjects').delete().eq('id', subjectId)
    if (!error) {
      set({
        semesters: get().semesters.map((s) =>
          s.id === semesterId ? { ...s, subjects: s.subjects.filter((sub) => sub.id !== subjectId) } : s
        ),
      })
    }
    return { error }
  },

  // Study Sessions
  addStudySession: async (data, userId) => {
    const { data: row, error } = await supabase.from('study_sessions').insert({ ...data, user_id: userId }).select().single()
    if (row) set({ studySessions: [row, ...get().studySessions] })
    return { data: row, error }
  },

  // Exams CRUD
  addExam: async (data, userId) => {
    const { data: row, error } = await supabase.from('exams').insert({ ...data, user_id: userId }).select().single()
    if (row) set({ exams: [...get().exams, row].sort((a, b) => new Date(a.exam_date) - new Date(b.exam_date)) })
    return { data: row, error }
  },
  updateExam: async (id, data) => {
    const { data: row, error } = await supabase.from('exams').update(data).eq('id', id).select().single()
    if (row) set({ exams: get().exams.map((e) => (e.id === id ? row : e)) })
    return { data: row, error }
  },
  deleteExam: async (id) => {
    const { error } = await supabase.from('exams').delete().eq('id', id)
    if (!error) set({ exams: get().exams.filter((e) => e.id !== id) })
    return { error }
  },

  // Goals CRUD
  addGoal: async (data, userId) => {
    const { data: row, error } = await supabase.from('goals').insert({ ...data, user_id: userId }).select().single()
    if (row) set({ goals: [row, ...get().goals] })
    return { data: row, error }
  },
  updateGoal: async (id, data) => {
    const { data: row, error } = await supabase.from('goals').update(data).eq('id', id).select().single()
    if (row) set({ goals: get().goals.map((g) => (g.id === id ? row : g)) })
    return { data: row, error }
  },
  deleteGoal: async (id) => {
    const { error } = await supabase.from('goals').delete().eq('id', id)
    if (!error) set({ goals: get().goals.filter((g) => g.id !== id) })
    return { error }
  },

  // Badges
  awardBadge: async (badgeType, userId) => {
    const existing = get().badges.find((b) => b.badge_type === badgeType)
    if (existing) return
    const { data: row, error } = await supabase.from('badges').insert({ user_id: userId, badge_type: badgeType }).select().single()
    if (row) set({ badges: [...get().badges, row] })
    return { data: row, error }
  },
}))

export const useTimerStore = create((set, get) => ({
  mode: 'pomodoro',
  customFocus: 25,
  customBreak: 5,
  timeLeft: 25 * 60,
  isRunning: false,
  isBreak: false,
  intervalId: null,

  setMode: (mode) => {
    const { customFocus, customBreak } = get()
    const focus = mode === 'custom' ? customFocus * 60 : mode === 'extended' ? 50 * 60 : 25 * 60
    set({ mode, timeLeft: focus, isBreak: false, isRunning: false })
  },

  setCustomTimes: (focus, breakTime) => {
    set({ customFocus: focus, customBreak: breakTime })
    if (get().mode === 'custom') set({ timeLeft: focus * 60 })
  },

  start: () => {
    if (get().isRunning) return
    const id = setInterval(() => {
      const { timeLeft, isRunning } = get()
      if (!isRunning) return
      if (timeLeft <= 1) {
        get().handleTimerComplete()
      } else {
        set({ timeLeft: timeLeft - 1 })
      }
    }, 1000)
    set({ isRunning: true, intervalId: id })
  },

  pause: () => {
    clearInterval(get().intervalId)
    set({ isRunning: false, intervalId: null })
  },

  reset: () => {
    clearInterval(get().intervalId)
    const { mode, customFocus } = get()
    const focus = mode === 'custom' ? customFocus * 60 : mode === 'extended' ? 50 * 60 : 25 * 60
    set({ isRunning: false, isBreak: false, timeLeft: focus, intervalId: null })
  },

  handleTimerComplete: () => {
    clearInterval(get().intervalId)
    const { isBreak, mode, customFocus, customBreak } = get()
    if (isBreak) {
      const focus = mode === 'custom' ? customFocus * 60 : mode === 'extended' ? 50 * 60 : 25 * 60
      set({ isBreak: false, timeLeft: focus, isRunning: false, intervalId: null })
    } else {
      const breakTime = mode === 'custom' ? customBreak * 60 : mode === 'extended' ? 10 * 60 : 5 * 60
      set({ isBreak: true, timeLeft: breakTime, isRunning: false, intervalId: null })
    }
  },
}))

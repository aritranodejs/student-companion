import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { notify } from '../lib/notify.jsx'
import { isCampusConfigured, studentMatchesClassCourse, teacherCanEditStudent, teacherMatchesClassCourse, validateTeacherStudentPayload } from '../lib/institutionRules'

const CLASS_SELECT = `
  *,
  course:courses(
    id, name, code,
    department:departments(id, name, code)
  )
`

export const useInstitutionStore = create((set, get) => ({
  allUsers: [],
  departments: [],
  courses: [],
  classes: [],
  enrollments: [],
  classAttendance: [],
  attendanceSessions: [],
  attendanceLogs: [],
  loading: false,

  fetchTeacherReferenceData: async (teacherId) => {
    set({ loading: true })
    try {
      const [departments, courses, classes] = await Promise.all([
        supabase.from('departments').select('*').order('name'),
        supabase.from('courses').select('*, department:departments(id, name, code)').order('name'),
        supabase.from('classes').select(CLASS_SELECT).eq('teacher_id', teacherId).order('name'),
      ])
      set({
        departments: departments.data || [],
        courses: courses.data || [],
        classes: classes.data || [],
      })
    } finally {
      set({ loading: false })
    }
  },

  fetchAdminData: async () => {
    set({ loading: true })
    try {
      const [users, departments, courses, classes, enrollments] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('departments').select('*').order('name'),
        supabase.from('courses').select('*, department:departments(id, name, code)').order('name'),
        supabase.from('classes').select(CLASS_SELECT).order('created_at', { ascending: false }),
        supabase.from('class_enrollments').select('*'),
      ])
      const userMap = Object.fromEntries((users.data || []).map((u) => [u.id, u]))
      set({
        allUsers: users.data || [],
        departments: departments.data || [],
        courses: courses.data || [],
        classes: (classes.data || []).map((c) => ({ ...c, teacher: userMap[c.teacher_id] || null })),
        enrollments: (enrollments.data || []).map((e) => ({ ...e, student: userMap[e.student_id] || null })),
      })
    } finally {
      set({ loading: false })
    }
  },

  fetchDepartments: async () => {
    const { data } = await supabase.from('departments').select('*').order('name')
    set({ departments: data || [] })
    return data || []
  },

  fetchCourses: async () => {
    const { data } = await supabase
      .from('courses')
      .select('*, department:departments(id, name, code)')
      .order('name')
    set({ courses: data || [] })
    return data || []
  },

  createDepartment: async (payload) => {
    const { data, error } = await supabase.from('departments').insert(payload).select().single()
    if (error) return { error }
    set({ departments: [...get().departments, data].sort((a, b) => a.name.localeCompare(b.name)) })
    notify.success('Department created')
    return { data }
  },

  updateDepartment: async (id, payload) => {
    const { data, error } = await supabase.from('departments').update(payload).eq('id', id).select().single()
    if (error) return { error }
    set({ departments: get().departments.map((d) => (d.id === id ? data : d)) })
    notify.success('Department updated')
    return { data }
  },

  deleteDepartment: async (id) => {
    const { error } = await supabase.from('departments').delete().eq('id', id)
    if (error) return { error }
    set({
      departments: get().departments.filter((d) => d.id !== id),
      courses: get().courses.filter((c) => c.department_id !== id),
    })
    notify.success('Department deleted')
    return {}
  },

  createCourse: async (payload) => {
    const { data, error } = await supabase
      .from('courses')
      .insert(payload)
      .select('*, department:departments(id, name, code)')
      .single()
    if (error) return { error }
    set({ courses: [...get().courses, data].sort((a, b) => a.name.localeCompare(b.name)) })
    notify.success('Course created')
    return { data }
  },

  updateCourse: async (id, payload) => {
    const { data, error } = await supabase
      .from('courses')
      .update(payload)
      .eq('id', id)
      .select('*, department:departments(id, name, code)')
      .single()
    if (error) return { error }
    set({ courses: get().courses.map((c) => (c.id === id ? data : c)) })
    notify.success('Course updated')
    return { data }
  },

  deleteCourse: async (id) => {
    const { error } = await supabase.from('courses').delete().eq('id', id)
    if (error) return { error }
    set({ courses: get().courses.filter((c) => c.id !== id) })
    notify.success('Course deleted')
    return {}
  },

  fetchTeacherClasses: async (teacherId) => {
    set({ loading: true })
    try {
      const { data } = await supabase
        .from('classes')
        .select(`${CLASS_SELECT}, enrollments:class_enrollments(count)`)
        .eq('teacher_id', teacherId)
        .order('name')
      set({ classes: data || [] })
    } finally {
      set({ loading: false })
    }
  },

  fetchStudentClasses: async (studentId) => {
    const { data } = await supabase
      .from('class_enrollments')
      .select(`*, class:classes(${CLASS_SELECT}, teacher:profiles!classes_teacher_id_fkey(name))`)
      .eq('student_id', studentId)
    return data || []
  },

  updateUserRole: async (userId, role, actorId) => {
    const target = get().allUsers.find((u) => u.id === userId)
    if (target?.role === 'admin' && userId === actorId && role !== 'admin') {
      return { error: { message: 'You cannot change your own admin role.' } }
    }
    const { data, error } = await supabase.from('profiles').update({ role }).eq('id', userId).select().single()
    if (error) return { error }
    set({ allUsers: get().allUsers.map((u) => (u.id === userId ? data : u)) })
    notify.success(`User role updated to ${role}`)
    return { data }
  },

  updateUserProfile: async (userId, payload, actor) => {
    let target = get().allUsers.find((u) => u.id === userId)
    if (!target) {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
      target = data
    }
    if (!target) return { error: { message: 'User not found' } }

    if (actor.role === 'teacher' && !teacherCanEditStudent(actor, target, get().courses)) {
      return { error: { message: 'You can only edit students in your department' } }
    }

    const payloadCheck = validateTeacherStudentPayload(actor, payload, get().courses)
    if (!payloadCheck.ok) return { error: { message: payloadCheck.reason } }

    if (actor.role === 'teacher') {
      delete payload.role
    }

    if (payload.role && target.role === 'admin' && userId === actor.id && payload.role !== 'admin') {
      return { error: { message: 'You cannot change your own admin role.' } }
    }

    const updates = { ...payload }
    if (updates.course_id) {
      const course = get().courses.find((c) => c.id === updates.course_id)
      if (course) updates.department_id = course.department_id
    }
    if (target.role === 'admin' && userId === actor.id) {
      delete updates.role
    }
    if (updates.role === 'student' && !updates.course_id && payload.course_id === '') {
      updates.course_id = null
    }

    const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId).select().single()
    if (error) return { error }
    set({ allUsers: get().allUsers.map((u) => (u.id === userId ? data : u)) })
    notify.success('User updated')
    return { data }
  },

  fetchTeacherDeptStudents: async (teacherId) => {
    const { data: teacher } = await supabase.from('profiles').select('*').eq('id', teacherId).single()
    if (!teacher?.department_id) return []

    const { data: deptCourses } = await supabase.from('courses').select('id').eq('department_id', teacher.department_id)
    const courseIds = (deptCourses || []).map((c) => c.id)

    let query = supabase.from('profiles').select('*').eq('role', 'student')
    if (courseIds.length) {
      query = query.or(`department_id.eq.${teacher.department_id},course_id.in.(${courseIds.join(',')})`)
    } else {
      query = query.eq('department_id', teacher.department_id)
    }
    const { data } = await query.order('name')
    return data || []
  },

  createClass: async (payload) => {
    if (payload.teacher_id && payload.course_id) {
      const teacher = get().allUsers.find((u) => u.id === payload.teacher_id)
      const check = teacherMatchesClassCourse(teacher, payload.course_id, get().courses)
      if (!check.ok) return { error: { message: check.reason } }
    }
    const { data, error } = await supabase
      .from('classes')
      .insert(payload)
      .select(CLASS_SELECT)
      .single()
    if (error) return { error }
    const teacher = get().allUsers.find((u) => u.id === data.teacher_id)
    set({ classes: [{ ...data, teacher: teacher || null }, ...get().classes] })
    notify.success('Class created successfully')
    return { data }
  },

  updateClass: async (id, payload) => {
    const existing = get().classes.find((c) => c.id === id)
    const teacherId = payload.teacher_id ?? existing?.teacher_id
    const courseId = payload.course_id ?? existing?.course_id
    if (teacherId && courseId) {
      const teacher = get().allUsers.find((u) => u.id === teacherId)
      const check = teacherMatchesClassCourse(teacher, courseId, get().courses)
      if (!check.ok) return { error: { message: check.reason } }
    }
    const { data, error } = await supabase
      .from('classes')
      .update(payload)
      .eq('id', id)
      .select(CLASS_SELECT)
      .single()
    if (error) return { error }
    const teacher = get().allUsers.find((u) => u.id === data.teacher_id)
    set({ classes: get().classes.map((c) => (c.id === id ? { ...data, teacher: teacher || null } : c)) })
    notify.success('Class updated')
    return { data }
  },

  deleteClass: async (id) => {
    const { error } = await supabase.from('classes').delete().eq('id', id)
    if (error) return { error }
    set({ classes: get().classes.filter((c) => c.id !== id) })
    notify.success('Class deleted')
    return {}
  },

  enrollStudent: async (classId, studentId) => {
    const cls = get().classes.find((c) => c.id === classId)
    const student = get().allUsers.find((u) => u.id === studentId)
    const check = studentMatchesClassCourse(student, cls)
    if (!check.ok) return { error: { message: check.reason } }

    const { data, error } = await supabase
      .from('class_enrollments')
      .insert({ class_id: classId, student_id: studentId })
      .select('*')
      .single()
    if (error) return { error }
    const row = { ...data, student }
    set({ enrollments: [...get().enrollments, row] })
    notify.success('Student enrolled in class')
    return { data: row }
  },

  unenrollStudent: async (enrollmentId) => {
    const { error } = await supabase.from('class_enrollments').delete().eq('id', enrollmentId)
    if (error) return { error }
    set({ enrollments: get().enrollments.filter((e) => e.id !== enrollmentId) })
    notify.success('Student removed from class')
    return {}
  },

  fetchClassAttendance: async (classId) => {
    const { data } = await supabase
      .from('class_attendance')
      .select('*')
      .eq('class_id', classId)
    set({ classAttendance: data || [] })
    return data || []
  },

  upsertClassAttendance: async (payload, teacherId) => {
    const { data, error } = await supabase
      .from('class_attendance')
      .upsert({ ...payload, updated_by: teacherId, updated_at: new Date().toISOString() }, { onConflict: 'class_id,student_id' })
      .select()
      .single()
    if (error) return { error }
    const list = get().classAttendance
    const exists = list.find((a) => a.id === data.id)
    set({ classAttendance: exists ? list.map((a) => (a.id === data.id ? data : a)) : [...list, data] })
    return { data }
  },

  saveFaceDescriptor: async (userId, descriptor, faceImageBlob = null) => {
    let face_image_url = null
    if (faceImageBlob) {
      const path = `${userId}/face.jpg`
      const { error: uploadError } = await supabase.storage
        .from('face-images')
        .upload(path, faceImageBlob, { upsert: true, contentType: 'image/jpeg' })
      if (uploadError) return { error: uploadError }
      const { data: urlData } = supabase.storage.from('face-images').getPublicUrl(path)
      face_image_url = urlData.publicUrl
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({
        face_descriptor: descriptor,
        face_registered_at: new Date().toISOString(),
        ...(face_image_url ? { face_image_url } : {}),
      })
      .eq('id', userId)
      .select()
      .single()
    if (error) return { error }
    notify.success('Face registered successfully')
    return { data }
  },

  fetchStudentTodaySessions: async (studentId) => {
    const today = new Date().toISOString().split('T')[0]
    const { data: enrollments } = await supabase
      .from('class_enrollments')
      .select('class_id')
      .eq('student_id', studentId)
    const classIds = (enrollments || []).map((e) => e.class_id)
    if (!classIds.length) {
      set({ attendanceSessions: [] })
      return []
    }
    const { data } = await supabase
      .from('attendance_sessions')
      .select('*, class:classes(id, name, code, campus_lat, campus_lng, campus_radius_m)')
      .in('class_id', classIds)
      .eq('session_date', today)
      .eq('is_open', true)
    set({ attendanceSessions: data || [] })
    return data || []
  },

  fetchStudentAttendanceLogs: async (studentId, limit = 30) => {
    const { data } = await supabase
      .from('attendance_logs')
      .select('*, session:attendance_sessions(session_date), class:classes(name, code)')
      .eq('student_id', studentId)
      .order('marked_at', { ascending: false })
      .limit(limit)
    set({ attendanceLogs: data || [] })
    return data || []
  },

  markDailyAttendance: async (payload, studentId, options = {}) => {
    const { data, error } = await supabase
      .from('attendance_logs')
      .insert({ ...payload, student_id: studentId, marked_by: studentId })
      .select('*, class:classes(name, code)')
      .single()
    if (error) return { error }
    set({ attendanceLogs: [data, ...get().attendanceLogs] })
    if (!options.silent) notify.attendance('Attendance marked successfully')
    return { data }
  },

  createAttendanceHandoff: async (sessionId, classId, studentId) => {
    await supabase
      .from('attendance_handoff_tokens')
      .update({ status: 'cancelled' })
      .eq('student_id', studentId)
      .eq('session_id', sessionId)
      .eq('status', 'pending')

    const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('attendance_handoff_tokens')
      .insert({
        student_id: studentId,
        session_id: sessionId,
        class_id: classId,
        expires_at,
      })
      .select()
      .single()
    return { data, error }
  },

  completeAttendanceHandoff: async (tokenId, logId) => {
    const { error } = await supabase
      .from('attendance_handoff_tokens')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        attendance_log_id: logId,
      })
      .eq('id', tokenId)
      .eq('status', 'pending')
    return { error }
  },

  createFaceRegistrationHandoff: async (studentId) => {
    await supabase
      .from('face_registration_handoff_tokens')
      .update({ status: 'cancelled' })
      .eq('student_id', studentId)
      .eq('status', 'pending')

    const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('face_registration_handoff_tokens')
      .insert({ student_id: studentId, expires_at })
      .select()
      .single()
    return { data, error }
  },

  completeFaceRegistrationHandoff: async (tokenId) => {
    const { error } = await supabase
      .from('face_registration_handoff_tokens')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', tokenId)
      .eq('status', 'pending')
    return { error }
  },

  openAttendanceSession: async (classId, teacherId, options = {}) => {
    const today = new Date().toISOString().split('T')[0]
    const cls = get().classes.find((c) => c.id === classId)
    const campusLat = options.campus_lat ?? cls?.campus_lat ?? null
    const campusLng = options.campus_lng ?? cls?.campus_lng ?? null
    const hasCampus = isCampusConfigured(campusLat, campusLng)

    if (!hasCampus) {
      return { error: { message: 'Set and save campus latitude & longitude before opening attendance.' } }
    }

    const payload = {
      class_id: classId,
      session_date: today,
      created_by: teacherId,
      require_face: options.require_face ?? true,
      require_location: true,
      campus_lat: Number(campusLat),
      campus_lng: Number(campusLng),
      campus_radius_m: options.campus_radius_m ?? cls?.campus_radius_m ?? 150,
      is_open: true,
    }
    const { data, error } = await supabase
      .from('attendance_sessions')
      .upsert(payload, { onConflict: 'class_id,session_date' })
      .select('*, class:classes(name, code)')
      .single()
    if (error) return { error }
    notify.success(`Attendance session opened for ${data.class?.name || 'class'}`)
    return { data }
  },

  closeAttendanceSession: async (sessionId) => {
    const { data, error } = await supabase
      .from('attendance_sessions')
      .update({ is_open: false, closes_at: new Date().toISOString() })
      .eq('id', sessionId)
      .select()
      .single()
    if (error) return { error }
    notify.success('Attendance session closed')
    return { data }
  },

  fetchSessionLogs: async (sessionId) => {
    const { data } = await supabase
      .from('attendance_logs')
      .select('*, student:profiles!attendance_logs_student_id_fkey(id, name, roll_number, email)')
      .eq('session_id', sessionId)
      .order('marked_at')
    set({ attendanceLogs: data || [] })
    return data || []
  },

  fetchClassAttendanceLogs: async (classId, fromDate, toDate) => {
    let query = supabase
      .from('attendance_logs')
      .select('*, student:profiles!attendance_logs_student_id_fkey(name, roll_number, email), session:attendance_sessions(session_date)')
      .eq('class_id', classId)
      .order('marked_at', { ascending: false })
    if (fromDate) query = query.gte('marked_at', `${fromDate}T00:00:00`)
    if (toDate) query = query.lte('marked_at', `${toDate}T23:59:59`)
    const { data } = await query
    return data || []
  },

  teacherMarkAttendance: async (payload, teacherId) => {
    const { data, error } = await supabase
      .from('attendance_logs')
      .upsert({ ...payload, marked_by: teacherId, method: 'manual' }, { onConflict: 'session_id,student_id' })
      .select()
      .single()
    if (error) return { error }
    notify.attendance('Attendance updated')
    return { data }
  },

  updateClassCampus: async (classId, campus) => {
    const { data, error } = await supabase
      .from('classes')
      .update(campus)
      .eq('id', classId)
      .select()
      .single()
    if (error) return { error }
    set({ classes: get().classes.map((c) => (c.id === classId ? { ...c, ...data } : c)) })
    return { data }
  },

  createClassAssignment: async (payload, teacherId) => {
    const { data, error } = await supabase
      .from('assignments')
      .insert({ ...payload, created_by: teacherId, user_id: teacherId })
      .select()
      .single()
    if (error) return { error }

    const { data: enrolled } = await supabase
      .from('class_enrollments')
      .select('student_id')
      .eq('class_id', payload.class_id)

    if (enrolled?.length) {
      await supabase.from('assignment_submissions').insert(
        enrolled.map((e) => ({ assignment_id: data.id, student_id: e.student_id, status: 'pending' }))
      )
      await supabase.rpc('notify_class_students', {
        p_class_id: payload.class_id,
        p_title: 'New Assignment',
        p_message: `${payload.title} — due ${payload.due_date}`,
        p_type: 'assignment',
        p_link: '/assignments',
      })
    }

    notify.assignment(`"${payload.title}" posted for your class`)
    return { data }
  },

  createClassExam: async (payload, teacherId) => {
    const { data, error } = await supabase
      .from('exams')
      .insert({ ...payload, created_by: teacherId, user_id: teacherId })
      .select()
      .single()
    if (error) return { error }

    await supabase.rpc('notify_class_students', {
      p_class_id: payload.class_id,
      p_title: 'New Exam Scheduled',
      p_message: `${payload.exam_name} on ${payload.exam_date}`,
      p_type: 'exam',
      p_link: '/exams',
    })

    notify.exam(`"${payload.exam_name}" scheduled`)
    return { data }
  },
}))

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  fetchNotifications: async (userId) => {
    if (!userId) return
    set({ loading: true })
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    set({
      notifications: data || [],
      unreadCount: (data || []).filter((n) => !n.read).length,
      loading: false,
    })
  },

  markRead: async (id) => {
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id)
    if (!error) {
      set({
        notifications: get().notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        unreadCount: Math.max(0, get().unreadCount - 1),
      })
    }
  },

  markAllRead: async (userId) => {
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
    set({
      notifications: get().notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })
  },

  subscribe: (userId) => {
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const n = payload.new
        set({
          notifications: [n, ...get().notifications],
          unreadCount: get().unreadCount + 1,
        })
        const fn = notify[n.type] || notify.info
        fn(n.message, n.title)
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  },
}))

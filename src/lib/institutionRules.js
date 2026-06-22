/** Resolve campus geofence from session snapshot or class defaults */
export function getCampusCoords(session, classObj) {
  const lat = session?.campus_lat ?? classObj?.campus_lat
  const lng = session?.campus_lng ?? classObj?.campus_lng
  const radius = session?.campus_radius_m ?? classObj?.campus_radius_m ?? 150
  return { lat, lng, radius: Number(radius) || 150 }
}

export function isCampusConfigured(lat, lng) {
  if (lat == null || lng == null) return false
  const a = Number(lat)
  const b = Number(lng)
  return Number.isFinite(a) && Number.isFinite(b)
}

export function canMarkAttendanceSession(session, classObj, hasFaceRegistered) {
  if (!hasFaceRegistered) return { ok: false, reason: 'Register your face first' }
  if (session.require_face === false && session.require_location === false) {
    return { ok: false, reason: 'Session verification not configured' }
  }
  if (session.require_location) {
    const { lat, lng } = getCampusCoords(session, classObj)
    if (!isCampusConfigured(lat, lng)) {
      return { ok: false, reason: 'Teacher has not set campus location yet' }
    }
  }
  return { ok: true }
}

export function studentMatchesClassCourse(student, classRow) {
  if (!student) return { ok: false, reason: 'Student not found' }
  if (student.role !== 'student') return { ok: false, reason: 'Only students can be enrolled in classes' }
  if (!classRow?.course_id) return { ok: false, reason: 'Class has no course assigned' }
  if (!student.course_id) return { ok: false, reason: 'Student has no admission course. Assign course first.' }
  if (student.course_id !== classRow.course_id) {
    return { ok: false, reason: 'Student can only join classes for their admitted course' }
  }
  return { ok: true }
}

export function teacherCanEditStudent(teacher, student, courses, options = {}) {
  if (!teacher || !student) return false
  if (teacher.role === 'admin') return true
  if (teacher.role !== 'teacher') return false
  if (student.role !== 'student') return false
  if (options.enrolledInMyClass) return true
  if (!teacher.department_id) return false
  if (student.department_id === teacher.department_id) return true
  if (student.course_id) {
    const course = courses.find((c) => c.id === student.course_id)
    return course?.department_id === teacher.department_id
  }
  return false
}

export function teacherDeptCourses(courses, departmentId) {
  if (!departmentId) return []
  return courses.filter((c) => c.department_id === departmentId)
}

export function teacherMatchesClassCourse(teacher, courseId, courses) {
  if (!teacher || teacher.role !== 'teacher') return { ok: true }
  if (!courseId) return { ok: false, reason: 'Select a course for this class' }
  if (!teacher.department_id) {
    return { ok: false, reason: 'Teacher has no department assigned. Set department on user profile first.' }
  }
  const course = courses.find((c) => c.id === courseId)
  if (!course) return { ok: false, reason: 'Course not found' }
  if (course.department_id !== teacher.department_id) {
    return { ok: false, reason: 'Teacher must belong to the same department as the class course' }
  }
  return { ok: true }
}

export function teacherCanAssignCourse(teacher, courseId, courses) {
  return teacherMatchesClassCourse(teacher, courseId, courses).ok
}

export function validateTeacherStudentPayload(teacher, payload, courses) {
  if (!teacher || teacher.role !== 'teacher') return { ok: true }
  if (!teacher.department_id) return { ok: false, reason: 'Your profile has no department assigned' }
  if (payload.department_id && payload.department_id !== teacher.department_id) {
    return { ok: false, reason: 'You can only assign students within your department' }
  }
  if (payload.course_id) {
    const course = courses.find((c) => c.id === payload.course_id)
    if (!course || course.department_id !== teacher.department_id) {
      return { ok: false, reason: 'Admitted course must be in your department' }
    }
  }
  return { ok: true }
}

export function normalizeCode(value) {
  return (value || '').trim().toUpperCase()
}

export function normalizeText(value) {
  return (value || '').trim()
}

export function validateDepartmentPayload(payload) {
  const name = normalizeText(payload.name)
  const code = normalizeCode(payload.code)
  if (!name) return { ok: false, reason: 'Department name is required' }
  if (!code) return { ok: false, reason: 'Department code is required' }
  if (!/^[A-Z0-9_-]{2,12}$/.test(code)) {
    return { ok: false, reason: 'Department code: 2–12 letters, numbers, - or _' }
  }
  return { ok: true, payload: { ...payload, name, code, description: normalizeText(payload.description) || null } }
}

export function validateCoursePayload(payload) {
  const name = normalizeText(payload.name)
  const code = normalizeCode(payload.code)
  if (!payload.department_id) return { ok: false, reason: 'Department is required' }
  if (!name) return { ok: false, reason: 'Course name is required' }
  if (!code) return { ok: false, reason: 'Course code is required' }
  if (!/^[A-Z0-9_-]{2,16}$/.test(code)) {
    return { ok: false, reason: 'Course code: 2–16 letters, numbers, - or _' }
  }
  const years = payload.duration_years
  if (years != null && years !== '' && (Number(years) < 1 || Number(years) > 10)) {
    return { ok: false, reason: 'Duration must be between 1 and 10 years' }
  }
  return {
    ok: true,
    payload: {
      ...payload,
      name,
      code,
      description: normalizeText(payload.description) || null,
      duration_years: years ? Number(years) : null,
    },
  }
}

export function validateClassPayload(payload, classes, excludeId = null) {
  const name = normalizeText(payload.name)
  const code = normalizeCode(payload.code)
  if (!payload.course_id) return { ok: false, reason: 'Course is required for every class' }
  if (!name) return { ok: false, reason: 'Class name is required' }
  if (!code) return { ok: false, reason: 'Class code is required' }
  if (!/^[A-Z0-9_-]{2,20}$/.test(code)) {
    return { ok: false, reason: 'Class code: 2–20 letters, numbers, - or _' }
  }
  const duplicate = (classes || []).find(
    (c) => c.course_id === payload.course_id
      && normalizeCode(c.code) === code
      && c.id !== excludeId
  )
  if (duplicate) return { ok: false, reason: `Class code "${code}" already exists for this course` }
  return { ok: true, payload: { ...payload, name, code } }
}

export function validateRollNumber(rollNumber) {
  const roll = normalizeText(rollNumber)
  if (!roll) return { ok: true, value: null }
  if (roll.length < 3 || roll.length > 32) {
    return { ok: false, reason: 'Roll number must be 3–32 characters' }
  }
  if (!/^[A-Za-z0-9/_-]+$/.test(roll)) {
    return { ok: false, reason: 'Roll number: letters, numbers, /, - or _ only' }
  }
  return { ok: true, value: roll.toUpperCase() }
}

export function isAlreadyEnrolled(enrollments, classId, studentId) {
  return (enrollments || []).some((e) => e.class_id === classId && e.student_id === studentId)
}

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

export function teacherCanEditStudent(teacher, student, courses) {
  if (!teacher || !student) return false
  if (teacher.role === 'admin') return true
  if (teacher.role !== 'teacher') return false
  if (student.role !== 'student') return false
  if (!teacher.department_id) return false
  if (student.department_id === teacher.department_id) return true
  if (student.course_id) {
    const course = courses.find((c) => c.id === student.course_id)
    return course?.department_id === teacher.department_id
  }
  return false
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

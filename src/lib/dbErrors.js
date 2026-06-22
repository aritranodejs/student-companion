/** Map Postgres / Supabase errors to user-friendly messages */
export function formatDbError(error) {
  if (!error) return 'Something went wrong'
  const msg = error.message || ''
  const code = error.code

  if (code === '23505') {
    if (/classes.*code|idx_classes_course_code/i.test(msg)) return 'A class with this code already exists for the selected course.'
    if (/departments.*code/i.test(msg)) return 'Department code already exists.'
    if (/courses.*department_id.*code|courses_department/i.test(msg)) return 'Course code already exists in this department.'
    if (/class_enrollments/i.test(msg)) return 'Student is already enrolled in this class.'
    if (/roll_number|idx_profiles_roll/i.test(msg)) return 'Roll number is already assigned to another student.'
    if (/attendance_logs/i.test(msg)) return 'Attendance already marked for this session.'
    if (/assignment_submissions/i.test(msg)) return 'Submission record already exists.'
    if (/badges/i.test(msg)) return 'Badge already earned.'
    return 'This record already exists.'
  }

  if (code === '23514') return 'Invalid value — check required fields and limits.'
  if (code === '23503') return 'Referenced record not found. Refresh and try again.'
  if (code === 'P0001' || msg.includes('RAISE EXCEPTION')) {
    const cleaned = msg.replace(/^.*?:\s*/, '').trim()
    return cleaned || 'Validation failed'
  }

  return msg || 'Something went wrong'
}

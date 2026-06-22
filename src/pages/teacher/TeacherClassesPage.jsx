import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { HiOutlinePlus, HiOutlineTrash, HiOutlineUserAdd, HiOutlinePencil, HiOutlineLocationMarker } from 'react-icons/hi'
import { useAuthStore } from '../../stores'
import { useInstitutionStore } from '../../stores/institution'
import Modal from '../../components/ui/Modal'
import { notify } from '../../lib/notify.jsx'
import { studentMatchesClassCourse, teacherDeptCourses, teacherMatchesClassCourse } from '../../lib/institutionRules'
import { useConfirm } from '../../components/ui/ConfirmProvider'

function classPath(c) {
  const dept = c.course?.department?.name
  const course = c.course?.code
  if (dept && course) return `${dept} → ${course}`
  return 'No course assigned'
}

export default function TeacherClassesPage() {
  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const {
    classes, courses, departments, enrollments, loading,
    fetchTeacherClassData, fetchTeacherDeptStudents,
    createClass, updateClass, deleteClass, enrollStudent, unenrollStudent, updateClassCampus,
  } = useInstitutionStore()

  const [classModal, setClassModal] = useState(null)
  const [enrollModal, setEnrollModal] = useState(null)
  const [campusModal, setCampusModal] = useState(null)
  const [deptStudents, setDeptStudents] = useState([])
  const [campusLat, setCampusLat] = useState('')
  const [campusLng, setCampusLng] = useState('')
  const [campusRadius, setCampusRadius] = useState('150')
  const classForm = useForm()
  const confirm = useConfirm()

  const myCourses = teacherDeptCourses(courses, profile?.department_id)

  useEffect(() => {
    if (user?.id) load()
  }, [user?.id])

  const load = async () => {
    await fetchTeacherClassData(user.id)
    const students = await fetchTeacherDeptStudents(user.id)
    setDeptStudents(students)
  }

  const openCreate = () => {
    classForm.reset({
      name: '',
      code: '',
      course_id: myCourses[0]?.id || '',
    })
    setClassModal({ mode: 'create' })
  }

  const openEdit = (cls) => {
    classForm.reset({
      name: cls.name,
      code: cls.code,
      course_id: cls.course_id || '',
    })
    setClassModal({ mode: 'edit', id: cls.id })
  }

  const openCampus = (cls) => {
    setCampusModal(cls)
    setCampusLat(cls.campus_lat ?? '')
    setCampusLng(cls.campus_lng ?? '')
    setCampusRadius(String(cls.campus_radius_m ?? 150))
  }

  const handleSaveClass = async (data) => {
    const check = teacherMatchesClassCourse(profile, data.course_id, courses)
    if (!check.ok) {
      notify.error(check.reason)
      return
    }
    const payload = {
      name: data.name,
      code: data.code,
      course_id: data.course_id,
      teacher_id: user.id,
    }
    const { error } = classModal.mode === 'create'
      ? await createClass(payload)
      : await updateClass(classModal.id, { name: data.name, code: data.code, course_id: data.course_id })
    if (error) notify.error(error.message)
    else {
      setClassModal(null)
      classForm.reset()
      load()
    }
  }

  const handleSaveCampus = async () => {
    if (!campusModal) return
    if (!campusLat || !campusLng) {
      notify.error('Enter campus latitude and longitude')
      return
    }
    const { error } = await updateClassCampus(campusModal.id, {
      campus_lat: Number(campusLat),
      campus_lng: Number(campusLng),
      campus_radius_m: Number(campusRadius) || 150,
    })
    if (error) notify.error(error.message)
    else {
      notify.success('Campus GPS saved')
      setCampusModal(null)
      load()
    }
  }

  const handleDeleteClass = async (cls) => {
    const count = classEnrollments(cls.id).length
    const ok = await confirm({
      title: 'Delete Class',
      message: count
        ? `Delete "${cls.name}"? ${count} student(s) will be unenrolled.`
        : `Delete "${cls.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'error',
    })
    if (!ok) return
    const { error } = await deleteClass(cls.id)
    if (error) notify.error(error.message)
    else load()
  }

  const handleUnenroll = async (enrollment) => {
    const ok = await confirm({
      title: 'Remove Student',
      message: `Remove ${enrollment.student?.name || 'this student'} from the class?`,
      confirmLabel: 'Remove',
      variant: 'warning',
    })
    if (!ok) return
    const { error } = await unenrollStudent(enrollment.id)
    if (error) notify.error(error.message)
    else load()
  }

  const classEnrollments = (classId) => enrollments.filter((e) => e.class_id === classId)
  const enrollClass = classes.find((c) => c.id === enrollModal)
  const enrollableStudents = deptStudents.map((s) => {
    const check = studentMatchesClassCourse(s, enrollClass)
    return { student: s, ...check }
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">My Classes</h1>
          <p className="page-subtitle">Create sections, set campus GPS, and enroll students from your department</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          disabled={!profile?.department_id || myCourses.length === 0}
          className="btn-primary disabled:opacity-50"
        >
          <HiOutlinePlus className="h-5 w-5" /> Create Class
        </button>
      </div>

      {!profile?.department_id && (
        <div className="glass-card border-amber-200 bg-amber-50/50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/20">
          Your profile has no department. Ask admin to assign your department before creating classes.
        </div>
      )}

      {profile?.department_id && myCourses.length === 0 && (
        <div className="glass-card border-amber-200 bg-amber-50/50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/20">
          No courses in your department yet. Ask admin to add courses under your department.
        </div>
      )}

      {loading ? (
        <div className="skeleton h-48 w-full rounded-2xl" />
      ) : classes.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <p className="text-slate-500">No classes yet. Create your first section above.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {classes.map((c) => (
            <div key={c.id} className="glass-card-hover p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{c.name}</h3>
                  <p className="text-sm text-indigo-600">{c.code}</p>
                  <p className="mt-1 text-xs text-slate-500">{classPath(c)}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    GPS: {c.campus_lat != null && c.campus_lng != null ? `${c.campus_lat}, ${c.campus_lng}` : 'Not set'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => setEnrollModal(c.id)} className="rounded-lg p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/30" title="Enroll students">
                    <HiOutlineUserAdd className="h-5 w-5" />
                  </button>
                  <button type="button" onClick={() => openCampus(c)} className="rounded-lg p-2 text-teal-500 hover:bg-teal-50 dark:hover:bg-teal-950/30" title="Campus GPS">
                    <HiOutlineLocationMarker className="h-5 w-5" />
                  </button>
                  <button type="button" onClick={() => openEdit(c)} className="rounded-lg p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/30" title="Edit class">
                    <HiOutlinePencil className="h-5 w-5" />
                  </button>
                  <button type="button" onClick={() => handleDeleteClass(c)} className="rounded-lg p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30">
                    <HiOutlineTrash className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link to="/teacher/attendance" className="text-xs font-medium text-indigo-600 hover:underline">Attendance →</Link>
                <Link to="/teacher/assignments" className="text-xs font-medium text-indigo-600 hover:underline">Assignments →</Link>
              </div>

              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase text-slate-400">
                  Enrolled ({classEnrollments(c.id).length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {classEnrollments(c.id).map((e) => (
                    <span key={e.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs dark:bg-slate-800">
                      {e.student?.name}
                      <button type="button" onClick={() => handleUnenroll(e)} className="text-red-400 hover:text-red-600">×</button>
                    </span>
                  ))}
                  {classEnrollments(c.id).length === 0 && (
                    <span className="text-xs text-slate-400">No students — enroll from your department</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={!!classModal} onClose={() => setClassModal(null)} title={classModal?.mode === 'edit' ? 'Edit Class' : 'Create Class'}>
        <form onSubmit={classForm.handleSubmit(handleSaveClass)} className="space-y-4">
          <div>
            <label className="label-text">Course</label>
            <select {...classForm.register('course_id', { required: true })} className="input-field">
              <option value="">Select course...</option>
              {myCourses.map((c) => (
                <option key={c.id} value={c.id}>{c.department?.name} → {c.code} — {c.name}</option>
              ))}
            </select>
          </div>
          <div><label className="label-text">Class Name</label><input {...classForm.register('name', { required: true })} className="input-field" placeholder="BCA 3rd Year — Section A" /></div>
          <div><label className="label-text">Class Code</label><input {...classForm.register('code', { required: true })} className="input-field" placeholder="BCA3-A" /></div>
          <button type="submit" className="btn-primary w-full">{classModal?.mode === 'edit' ? 'Save Changes' : 'Create Class'}</button>
        </form>
      </Modal>

      <Modal isOpen={!!enrollModal} onClose={() => setEnrollModal(null)} title="Enroll Student">
        <p className="mb-3 text-xs text-slate-500">
          Students must be admitted to <strong>{enrollClass?.course?.code || 'this course'}</strong>.
          Set admission on <Link to="/teacher/students" className="text-indigo-600 hover:underline">Students</Link> first if needed.
        </p>
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {enrollableStudents.length === 0 ? (
            <p className="text-sm text-slate-500">No students in your department yet.</p>
          ) : enrollableStudents.map(({ student: s, ok, reason }) => {
            const already = enrollments.some((e) => e.class_id === enrollModal && e.student_id === s.id)
            const disabled = already || !ok
            return (
              <button
                key={s.id}
                type="button"
                disabled={disabled}
                onClick={async () => {
                  const { error } = await enrollStudent(enrollModal, s.id)
                  if (error) notify.error(error.message)
                  else load()
                }}
                className="flex w-full flex-col rounded-xl bg-slate-50 px-4 py-3 text-left hover:bg-indigo-50 disabled:opacity-40 dark:bg-slate-800 dark:hover:bg-indigo-950/30"
              >
                <span className="text-sm font-medium">{s.name}</span>
                <span className="text-xs text-slate-400">
                  {already ? 'Already enrolled' : !ok ? reason : s.roll_number || s.email}
                </span>
              </button>
            )
          })}
        </div>
      </Modal>

      <Modal isOpen={!!campusModal} onClose={() => setCampusModal(null)} title={`Campus GPS — ${campusModal?.name || ''}`}>
        <p className="mb-4 text-xs text-slate-500">Required for GPS attendance geofence. Students must be within the radius to mark present.</p>
        <div className="space-y-3">
          <div><label className="label-text">Latitude</label><input value={campusLat} onChange={(e) => setCampusLat(e.target.value)} className="input-field" placeholder="22.5726" /></div>
          <div><label className="label-text">Longitude</label><input value={campusLng} onChange={(e) => setCampusLng(e.target.value)} className="input-field" placeholder="88.3639" /></div>
          <div><label className="label-text">Radius (m)</label><input value={campusRadius} onChange={(e) => setCampusRadius(e.target.value)} className="input-field" /></div>
          <button type="button" onClick={handleSaveCampus} className="btn-primary w-full">Save Campus Location</button>
        </div>
      </Modal>
    </div>
  )
}

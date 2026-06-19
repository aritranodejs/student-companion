import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { HiOutlinePlus, HiOutlineTrash, HiOutlineUserAdd } from 'react-icons/hi'
import { useInstitutionStore } from '../../stores/institution'
import Modal from '../../components/ui/Modal'
import { notify } from '../../lib/notify.jsx'
import { studentMatchesClassCourse } from '../../lib/institutionRules'
import { useConfirm } from '../../components/ui/ConfirmProvider'

function classPath(c) {
  const dept = c.course?.department?.name
  const course = c.course?.code
  if (dept && course) return `${dept} → ${course}`
  return c.department || 'No course assigned'
}

export default function AdminClassesPage() {
  const { classes, courses, allUsers, enrollments, loading, fetchAdminData, createClass, deleteClass, enrollStudent, unenrollStudent } = useInstitutionStore()
  const [classModal, setClassModal] = useState(false)
  const [enrollModal, setEnrollModal] = useState(null)
  const [filterCourse, setFilterCourse] = useState('all')
  const classForm = useForm()
  const confirm = useConfirm()
  const teachers = allUsers.filter((u) => u.role === 'teacher')
  const students = allUsers.filter((u) => u.role === 'student')

  useEffect(() => { fetchAdminData() }, [fetchAdminData])

  const filtered = filterCourse === 'all'
    ? classes
    : classes.filter((c) => c.course_id === filterCourse)

  const handleCreateClass = async (data) => {
    const { error } = await createClass({
      name: data.name,
      code: data.code,
      course_id: data.course_id,
      teacher_id: data.teacher_id || null,
    })
    if (error) notify.error(error.message)
    else { setClassModal(false); classForm.reset() }
  }

  const classEnrollments = (classId) => enrollments.filter((e) => e.class_id === classId)

  const enrollClass = classes.find((c) => c.id === enrollModal)

  const enrollableStudents = students.map((s) => {
    const check = studentMatchesClassCourse(s, enrollClass)
    return { student: s, ...check }
  })

  const handleDeleteClass = async (cls) => {
    const count = classEnrollments(cls.id).length
    const ok = await confirm({
      title: 'Delete Class',
      message: count
        ? `Delete "${cls.name}"? ${count} student(s) are enrolled — they will be unenrolled.`
        : `Delete "${cls.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'error',
    })
    if (!ok) return
    const { error } = await deleteClass(cls.id)
    if (error) notify.error(error.message)
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
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Class Management</h1>
          <p className="page-subtitle">Create classes under a course, assign teachers, enroll students</p>
        </div>
        <button onClick={() => setClassModal(true)} disabled={courses.length === 0} className="btn-primary disabled:opacity-50">
          <HiOutlinePlus className="h-5 w-5" /> Create Class
        </button>
      </div>

      {courses.length === 0 && !loading && (
        <div className="glass-card border-amber-200 bg-amber-50/50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
          Add departments and courses first, then create classes here.
        </div>
      )}

      <select value={filterCourse} onChange={(e) => setFilterCourse(e.target.value)} className="input-field w-auto">
        <option value="all">All Courses</option>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>{c.department?.code} — {c.code} ({c.name})</option>
        ))}
      </select>

      {loading ? (
        <div className="skeleton h-48 w-full rounded-2xl" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((c) => (
            <div key={c.id} className="glass-card-hover p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{c.name}</h3>
                  <p className="text-sm text-indigo-600">{c.code}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {classPath(c)} · Teacher: {c.teacher?.name || 'Unassigned'}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEnrollModal(c.id)} className="rounded-lg p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/30" title="Enroll students">
                    <HiOutlineUserAdd className="h-5 w-5" />
                  </button>
                  <button type="button" onClick={() => handleDeleteClass(c)} className="rounded-lg p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30">
                    <HiOutlineTrash className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Enrolled Students ({classEnrollments(c.id).length})</p>
                <div className="flex flex-wrap gap-2">
                  {classEnrollments(c.id).map((e) => (
                    <span key={e.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs dark:bg-slate-800">
                      {e.student?.name}
                      <button type="button" onClick={() => handleUnenroll(e)} className="text-red-400 hover:text-red-600">×</button>
                    </span>
                  ))}
                  {classEnrollments(c.id).length === 0 && <span className="text-xs text-slate-400">No students enrolled</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={classModal} onClose={() => setClassModal(false)} title="Create Class">
        <form onSubmit={classForm.handleSubmit(handleCreateClass)} className="space-y-4">
          <div>
            <label className="label-text">Course</label>
            <select {...classForm.register('course_id', { required: true })} className="input-field">
              <option value="">Select course...</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.department?.name} → {c.code} — {c.name}</option>
              ))}
            </select>
          </div>
          <div><label className="label-text">Class Name</label><input {...classForm.register('name', { required: true })} className="input-field" placeholder="BCA 3rd Year — Section A" /></div>
          <div><label className="label-text">Class Code</label><input {...classForm.register('code', { required: true })} className="input-field" placeholder="BCA3-A" /></div>
          <div>
            <label className="label-text">Assign Teacher</label>
            <select {...classForm.register('teacher_id')} className="input-field">
              <option value="">Select teacher...</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <button type="submit" className="btn-primary w-full">Create Class</button>
        </form>
      </Modal>

      <Modal isOpen={!!enrollModal} onClose={() => setEnrollModal(null)} title="Enroll Student">
        <p className="mb-3 text-xs text-slate-500">Only students admitted to <strong>{enrollClass?.course?.code || 'this course'}</strong> can be enrolled.</p>
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {enrollableStudents.map(({ student: s, ok, reason }) => {
            const already = enrollments.some((e) => e.class_id === enrollModal && e.student_id === s.id)
            const disabled = already || !ok
            return (
              <button
                key={s.id}
                disabled={disabled}
                onClick={async () => {
                  const { error } = await enrollStudent(enrollModal, s.id)
                  if (error) notify.error(error.message)
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
    </div>
  )
}

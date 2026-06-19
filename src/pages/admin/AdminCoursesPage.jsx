import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { HiOutlinePlus, HiOutlineTrash, HiOutlinePencil } from 'react-icons/hi'
import { useInstitutionStore } from '../../stores/institution'
import Modal from '../../components/ui/Modal'
import { notify } from '../../lib/notify.jsx'

export default function AdminCoursesPage() {
  const { departments, courses, classes, loading, fetchAdminData, createCourse, updateCourse, deleteCourse } = useInstitutionStore()
  const [modal, setModal] = useState(null)
  const [filterDept, setFilterDept] = useState('all')
  const form = useForm()

  useEffect(() => { fetchAdminData() }, [fetchAdminData])

  const classCount = (courseId) => classes.filter((c) => c.course_id === courseId).length

  const filtered = filterDept === 'all'
    ? courses
    : courses.filter((c) => c.department_id === filterDept)

  const openCreate = () => {
    form.reset({ department_id: departments[0]?.id || '', name: '', code: '', duration_years: 3, description: '' })
    setModal({ mode: 'create' })
  }

  const openEdit = (course) => {
    form.reset({
      department_id: course.department_id,
      name: course.name,
      code: course.code,
      duration_years: course.duration_years || '',
      description: course.description || '',
    })
    setModal({ mode: 'edit', id: course.id })
  }

  const onSubmit = async (data) => {
    const payload = {
      department_id: data.department_id,
      name: data.name,
      code: data.code.toUpperCase(),
      duration_years: data.duration_years ? Number(data.duration_years) : null,
      description: data.description || null,
    }
    const { error } = modal.mode === 'create'
      ? await createCourse(payload)
      : await updateCourse(modal.id, payload)
    if (error) notify.error(error.message)
    else setModal(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Courses</h1>
          <p className="page-subtitle">Programs under each department — BCA, MCA, BTech, MTech, etc.</p>
        </div>
        <button onClick={openCreate} disabled={departments.length === 0} className="btn-primary disabled:opacity-50">
          <HiOutlinePlus className="h-5 w-5" /> Add Course
        </button>
      </div>

      {departments.length === 0 && !loading && (
        <div className="glass-card border-amber-200 bg-amber-50/50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
          Create at least one department before adding courses.
        </div>
      )}

      <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="input-field w-auto">
        <option value="all">All Departments</option>
        {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>

      {loading ? (
        <div className="skeleton h-48 w-full rounded-2xl" />
      ) : filtered.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <p className="text-slate-500">No courses yet. Add BCA, MCA, BTech, or other programs.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <div key={c.id} className="glass-card-hover p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-indigo-600">{c.department?.name || '—'}</p>
                  <span className="mt-1 inline-block rounded-lg bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">
                    {c.code}
                  </span>
                  <h3 className="mt-2 font-semibold text-slate-900 dark:text-white">{c.name}</h3>
                  {c.duration_years && <p className="mt-1 text-xs text-slate-500">{c.duration_years}-year program</p>}
                  <p className="mt-2 text-xs text-slate-400">{classCount(c.id)} class{classCount(c.id) !== 1 ? 'es' : ''}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(c)} className="rounded-lg p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/30">
                    <HiOutlinePencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => deleteCourse(c.id)} className="rounded-lg p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30">
                    <HiOutlineTrash className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'edit' ? 'Edit Course' : 'Add Course'}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label-text">Department</label>
            <select {...form.register('department_id', { required: true })} className="input-field">
              <option value="">Select department...</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
            </select>
          </div>
          <div><label className="label-text">Course Name</label><input {...form.register('name', { required: true })} className="input-field" placeholder="Bachelor of Computer Applications" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label-text">Code</label><input {...form.register('code', { required: true })} className="input-field uppercase" placeholder="BCA" /></div>
            <div><label className="label-text">Duration (years)</label><input type="number" min={1} {...form.register('duration_years')} className="input-field" placeholder="3" /></div>
          </div>
          <div><label className="label-text">Description</label><textarea {...form.register('description')} className="input-field" rows={2} /></div>
          <button type="submit" className="btn-primary w-full">{modal?.mode === 'edit' ? 'Save Changes' : 'Create Course'}</button>
        </form>
      </Modal>
    </div>
  )
}

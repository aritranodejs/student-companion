import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { HiOutlinePlus, HiOutlineTrash, HiOutlinePencil } from 'react-icons/hi'
import { useInstitutionStore } from '../../stores/institution'
import Modal from '../../components/ui/Modal'
import { notify } from '../../lib/notify.jsx'

export default function AdminDepartmentsPage() {
  const { departments, courses, loading, fetchAdminData, createDepartment, updateDepartment, deleteDepartment } = useInstitutionStore()
  const [modal, setModal] = useState(null)
  const form = useForm()

  useEffect(() => { fetchAdminData() }, [fetchAdminData])

  const courseCount = (deptId) => courses.filter((c) => c.department_id === deptId).length

  const openCreate = () => {
    form.reset({ name: '', code: '', description: '' })
    setModal({ mode: 'create' })
  }

  const openEdit = (dept) => {
    form.reset({ name: dept.name, code: dept.code, description: dept.description || '' })
    setModal({ mode: 'edit', id: dept.id })
  }

  const onSubmit = async (data) => {
    const payload = { name: data.name, code: data.code.toUpperCase(), description: data.description || null }
    const { error } = modal.mode === 'create'
      ? await createDepartment(payload)
      : await updateDepartment(modal.id, payload)
    if (error) notify.error(error.message)
    else setModal(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Departments</h1>
          <p className="page-subtitle">Manage academic departments — Engineering, Computer Applications, etc.</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <HiOutlinePlus className="h-5 w-5" /> Add Department
        </button>
      </div>

      {loading ? (
        <div className="skeleton h-48 w-full rounded-2xl" />
      ) : departments.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <p className="text-slate-500">No departments yet. Create your first department to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((d) => (
            <div key={d.id} className="glass-card-hover p-5">
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-block rounded-lg bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                    {d.code}
                  </span>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{d.name}</h3>
                  {d.description && <p className="mt-1 text-sm text-slate-500">{d.description}</p>}
                  <p className="mt-2 text-xs text-slate-400">{courseCount(d.id)} course{courseCount(d.id) !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(d)} className="rounded-lg p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/30">
                    <HiOutlinePencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => deleteDepartment(d.id)} className="rounded-lg p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30">
                    <HiOutlineTrash className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'edit' ? 'Edit Department' : 'Add Department'}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div><label className="label-text">Department Name</label><input {...form.register('name', { required: true })} className="input-field" placeholder="Computer Applications" /></div>
          <div><label className="label-text">Code</label><input {...form.register('code', { required: true })} className="input-field uppercase" placeholder="CA" /></div>
          <div><label className="label-text">Description</label><textarea {...form.register('description')} className="input-field" rows={2} placeholder="Optional description" /></div>
          <button type="submit" className="btn-primary w-full">{modal?.mode === 'edit' ? 'Save Changes' : 'Create Department'}</button>
        </form>
      </Modal>
    </div>
  )
}

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import Modal from '../ui/Modal'

export default function UserEditModal({ user, departments, courses, onClose, onSave, canEditRole, isSelfAdmin }) {
  const form = useForm()

  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name || '',
        roll_number: user.roll_number || '',
        department_id: user.department_id || '',
        course_id: user.course_id || '',
        role: user.role || 'student',
      })
    }
  }, [user, form])

  if (!user) return null

  const role = form.watch('role') || user.role
  const deptId = form.watch('department_id')
  const deptCourses = courses.filter((c) => !deptId || c.department_id === deptId)

  const submit = async (data) => {
    await onSave({
      name: data.name.trim(),
      roll_number: data.roll_number?.trim() || null,
      department_id: data.department_id || null,
      course_id: data.role === 'student' ? (data.course_id || null) : null,
      role: canEditRole && !(isSelfAdmin && user.role === 'admin') ? data.role : user.role,
    })
  }

  return (
    <Modal isOpen onClose={onClose} title={`Edit — ${user.name}`}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
        <div>
          <label className="label-text">Full Name</label>
          <input {...form.register('name', { required: true })} className="input-field" />
        </div>
        {role === 'student' && (
          <div>
            <label className="label-text">Roll Number</label>
            <input {...form.register('roll_number')} className="input-field" />
          </div>
        )}
        <div>
          <label className="label-text">Department</label>
          <select {...form.register('department_id')} className="input-field">
            <option value="">— None —</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
          </select>
        </div>
        {role === 'student' && (
          <div>
            <label className="label-text">Admitted Course</label>
            <select {...form.register('course_id')} className="input-field">
              <option value="">— Select course —</option>
              {deptCourses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-500">Student can only enroll in classes under this course.</p>
          </div>
        )}
        {canEditRole && (
          <div>
            <label className="label-text">Role</label>
            {isSelfAdmin && user.role === 'admin' ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                Admin role cannot be changed on your own account.
              </p>
            ) : (
              <select {...form.register('role')} className="input-field">
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="admin">Admin</option>
              </select>
            )}
          </div>
        )}
        <button type="submit" className="btn-primary w-full">Save Changes</button>
      </form>
    </Modal>
  )
}

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useAuthStore } from '../../stores'
import { useInstitutionStore } from '../../stores/institution'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/ui/Modal'
import AssignmentSubmissionsPanel from '../../components/assignments/AssignmentSubmissionsPanel'
import { PRIORITIES } from '../../constants'
import { notify } from '../../lib/notify.jsx'
import { HiOutlinePlus, HiOutlineTrash, HiOutlineClipboardList } from 'react-icons/hi'

export default function TeacherAssignmentsPage() {
  const user = useAuthStore((s) => s.user)
  const { classes, fetchTeacherClasses, createClassAssignment } = useInstitutionStore()
  const [assignments, setAssignments] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [viewAssignment, setViewAssignment] = useState(null)
  const [submissionCounts, setSubmissionCounts] = useState({})
  const [enrolledCounts, setEnrolledCounts] = useState({})
  const form = useForm()
  const profile = useAuthStore((s) => s.profile)

  useEffect(() => {
    if (user?.id) {
      fetchTeacherClasses(user.id)
      loadAssignments()
    }
  }, [user?.id])

  const loadAssignments = async () => {
    const { data } = await supabase
      .from('assignments')
      .select('*, class:classes(name, code)')
      .eq('created_by', user.id)
      .not('class_id', 'is', null)
      .order('due_date')
    setAssignments(data || [])
    const counts = {}
    const enrolled = {}
    for (const a of data || []) {
      const [{ count }, { count: enrolledCount }] = await Promise.all([
        supabase.from('assignment_submissions').select('*', { count: 'exact', head: true }).eq('assignment_id', a.id).not('submitted_at', 'is', null),
        supabase.from('class_enrollments').select('*', { count: 'exact', head: true }).eq('class_id', a.class_id),
      ])
      counts[a.id] = count || 0
      enrolled[a.id] = enrolledCount || 0
    }
    setSubmissionCounts(counts)
    setEnrolledCounts(enrolled)
  }

  const onSubmit = async (data) => {
    const { error } = await createClassAssignment({
      class_id: data.class_id,
      title: data.title,
      subject: data.subject,
      description: data.description,
      due_date: data.due_date,
      priority: data.priority,
      status: 'pending',
    }, user.id)
    if (error) notify.error(error.message)
    else { setModalOpen(false); form.reset(); loadAssignments() }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this assignment?')) return
    await supabase.from('assignments').delete().eq('id', id)
    notify.success('Assignment deleted')
    loadAssignments()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Class Assignments</h1>
          <p className="page-subtitle">Post assignments, review submissions, and give feedback</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary" disabled={!classes.length}>
          <HiOutlinePlus /> Post Assignment
        </button>
      </div>

      <div className="space-y-3">
        {assignments.map((a) => (
          <div key={a.id} className="glass-card flex items-center justify-between p-4">
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">{a.title}</p>
              <p className="text-sm text-slate-500">{a.class?.name} · Due {a.due_date}</p>
              <p className="text-xs text-emerald-600">
                {submissionCounts[a.id] || 0}/{enrolledCounts[a.id] || 0} submitted
              </p>
              <span className="mt-1 inline-block rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-600 dark:bg-purple-950/30">{a.priority}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setViewAssignment(a)}
                className="btn-secondary py-2 text-sm"
                title="View all submissions"
              >
                <HiOutlineClipboardList className="h-5 w-5" /> Submissions
              </button>
              <button onClick={() => handleDelete(a.id)} className="rounded-lg p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30">
                <HiOutlineTrash className="h-5 w-5" />
              </button>
            </div>
          </div>
        ))}
        {!assignments.length && <p className="py-12 text-center text-slate-400">No assignments posted yet</p>}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Post Assignment">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label-text">Class</label>
            <select {...form.register('class_id', { required: true })} className="input-field">
              <option value="">Select class...</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label-text">Subject</label><input {...form.register('subject', { required: true })} className="input-field" /></div>
            <div><label className="label-text">Due Date</label><input type="date" {...form.register('due_date', { required: true })} className="input-field" /></div>
          </div>
          <div><label className="label-text">Title</label><input {...form.register('title', { required: true })} className="input-field" /></div>
          <div><label className="label-text">Description</label><textarea {...form.register('description')} className="input-field" rows={3} /></div>
          <div><label className="label-text">Priority</label>
            <select {...form.register('priority')} className="input-field">{PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</select>
          </div>
          <button type="submit" className="btn-primary w-full">Post & Notify Students</button>
        </form>
      </Modal>

      {viewAssignment && (
        <AssignmentSubmissionsPanel
          assignment={viewAssignment}
          teacherId={user.id}
          profile={profile}
          onClose={() => setViewAssignment(null)}
          onUpdated={loadAssignments}
        />
      )}
    </div>
  )
}

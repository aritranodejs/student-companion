import { useEffect, useState, useMemo } from 'react'
import { format } from 'date-fns'
import { HiOutlinePaperClip, HiOutlineChat, HiOutlineDownload } from 'react-icons/hi'
import { supabase } from '../../lib/supabase'
import { notify } from '../../lib/notify.jsx'
import { exportToCSV } from '../../utils/helpers'
import Modal from '../ui/Modal'
import AssignmentDetail from './AssignmentDetail'

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Graded / Done' },
]

const statusColor = {
  pending: 'bg-slate-100 text-slate-600 dark:bg-slate-800',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40',
}

export default function AssignmentSubmissionsPanel({ assignment, teacherId, profile, onClose, onUpdated }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [feedbackDraft, setFeedbackDraft] = useState({})
  const [commentAssignment, setCommentAssignment] = useState(null)

  useEffect(() => {
    loadSubmissions()
  }, [assignment.id])

  const loadSubmissions = async () => {
    setLoading(true)
    const { data: enrollments } = await supabase
      .from('class_enrollments')
      .select('student_id')
      .eq('class_id', assignment.class_id)

    const studentIds = (enrollments || []).map((e) => e.student_id)
    if (!studentIds.length) {
      setRows([])
      setLoading(false)
      return
    }

    const [{ data: students }, { data: submissions }] = await Promise.all([
      supabase.from('profiles').select('id, name, roll_number, email').in('id', studentIds),
      supabase.from('assignment_submissions').select('*').eq('assignment_id', assignment.id),
    ])

    const subMap = Object.fromEntries((submissions || []).map((s) => [s.student_id, s]))
    const merged = (students || []).map((student) => ({
      student,
      submission: subMap[student.id] || null,
    }))

    setRows(merged)
    const drafts = {}
    merged.forEach(({ student, submission }) => {
      drafts[student.id] = submission?.teacher_feedback || ''
    })
    setFeedbackDraft(drafts)
    setLoading(false)
  }

  const stats = useMemo(() => ({
    total: rows.length,
    submitted: rows.filter((r) => r.submission?.submitted_at).length,
    graded: rows.filter((r) => r.submission?.status === 'completed').length,
  }), [rows])

  const openFile = async (path, fileName) => {
    if (!path) return
    const { data, error } = await supabase.storage.from('submissions').createSignedUrl(path, 3600)
    if (error) notify.error(error.message)
    else if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const saveFeedback = async (studentId, submission) => {
    const feedback = feedbackDraft[studentId]?.trim() || null
    setSavingId(studentId)
    try {
      if (submission) {
        const { error } = await supabase
          .from('assignment_submissions')
          .update({ teacher_feedback: feedback, updated_at: new Date().toISOString() })
          .eq('id', submission.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('assignment_submissions').insert({
          assignment_id: assignment.id,
          student_id: studentId,
          status: 'pending',
          teacher_feedback: feedback,
        })
        if (error) throw error
      }
      notify.success('Feedback saved')
      if (feedback && studentId) {
        await supabase.from('notifications').insert({
          user_id: studentId,
          title: 'Assignment Feedback',
          message: `Your teacher left feedback on "${assignment.title}"`,
          type: 'assignment',
          link: '/assignments',
        })
      }
      await loadSubmissions()
      onUpdated?.()
    } catch (err) {
      notify.error(err.message || 'Could not save feedback')
    } finally {
      setSavingId(null)
    }
  }

  const updateStatus = async (submission, studentId, status) => {
    if (!submission) {
      const { error } = await supabase.from('assignment_submissions').insert({
        assignment_id: assignment.id,
        student_id: studentId,
        status,
      })
      if (error) notify.error(error.message)
      else loadSubmissions()
      return
    }
    const { error } = await supabase
      .from('assignment_submissions')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', submission.id)
    if (error) notify.error(error.message)
    else {
      notify.success('Status updated')
      loadSubmissions()
      onUpdated?.()
    }
  }

  const exportCsv = () => {
    const data = rows.map(({ student, submission }) => ({
      roll_number: student.roll_number || '',
      student_name: student.name,
      email: student.email,
      status: submission?.status || 'not_submitted',
      submitted_at: submission?.submitted_at || '',
      file_name: submission?.file_name || '',
      student_comment: submission?.student_comment || '',
      teacher_feedback: submission?.teacher_feedback || '',
    }))
    exportToCSV(data, `${assignment.title.replace(/\s+/g, '-')}-submissions.csv`)
    notify.success('CSV downloaded')
  }

  return (
    <>
      <Modal isOpen onClose={onClose} title={`Submissions — ${assignment.title}`}>
        <div className="max-h-[80vh] space-y-4 overflow-y-auto">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-indigo-600">{assignment.subject}</p>
              <p className="text-xs text-slate-500">Due {format(new Date(assignment.due_date), 'MMM d, yyyy')}</p>
              {assignment.class?.name && <p className="text-xs text-slate-400">{assignment.class.name}</p>}
            </div>
            <button onClick={exportCsv} className="btn-secondary text-sm">
              <HiOutlineDownload className="h-4 w-4" /> Export CSV
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/50">
              <p className="text-lg font-bold">{stats.total}</p>
              <p className="text-xs text-slate-500">Enrolled</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 text-center dark:bg-emerald-950/30">
              <p className="text-lg font-bold text-emerald-600">{stats.submitted}</p>
              <p className="text-xs text-slate-500">Submitted</p>
            </div>
            <div className="rounded-xl bg-indigo-50 p-3 text-center dark:bg-indigo-950/30">
              <p className="text-lg font-bold text-indigo-600">{stats.graded}</p>
              <p className="text-xs text-slate-500">Graded</p>
            </div>
          </div>

          {loading ? (
            <div className="skeleton h-48 w-full rounded-xl" />
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No students enrolled in this class.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-xs uppercase text-slate-500 dark:border-slate-700">
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3">File / Note</th>
                    <th className="px-4 py-3">Your Feedback</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ student, submission }) => (
                    <tr key={student.id} className="border-b border-slate-100 align-top dark:border-slate-800">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900 dark:text-white">{student.name}</p>
                        <p className="text-xs text-slate-400">{student.roll_number || student.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={submission?.status || 'pending'}
                          onChange={(e) => updateStatus(submission, student.id, e.target.value)}
                          className={`input-field py-1 text-xs ${statusColor[submission?.status || 'pending']}`}
                        >
                          {STATUS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {submission?.submitted_at
                          ? format(new Date(submission.submitted_at), 'MMM d, h:mm a')
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {submission?.file_url ? (
                          <button
                            type="button"
                            onClick={() => openFile(submission.file_url, submission.file_name)}
                            className="flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                          >
                            <HiOutlinePaperClip /> {submission.file_name || 'View file'}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">No file</span>
                        )}
                        {submission?.student_comment && (
                          <p className="mt-1 text-xs italic text-slate-500">&ldquo;{submission.student_comment}&rdquo;</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <textarea
                          value={feedbackDraft[student.id] ?? ''}
                          onChange={(e) => setFeedbackDraft((d) => ({ ...d, [student.id]: e.target.value }))}
                          className="input-field min-h-[72px] py-2 text-xs"
                          placeholder="Write feedback for this student..."
                          rows={2}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => saveFeedback(student.id, submission)}
                            disabled={savingId === student.id}
                            className="btn-primary py-1 text-xs disabled:opacity-50"
                          >
                            {savingId === student.id ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => setCommentAssignment({ ...assignment, _studentId: student.id })}
                            className="btn-secondary py-1 text-xs"
                          >
                            <HiOutlineChat className="inline h-3 w-3" /> Comment
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <h3 className="mb-2 text-sm font-semibold">Assignment discussion</h3>
            <button onClick={() => setCommentAssignment(assignment)} className="btn-secondary text-sm">
              <HiOutlineChat className="h-4 w-4" /> Open class comments
            </button>
          </div>
        </div>
      </Modal>

      {commentAssignment && (
        <AssignmentDetail
          assignment={commentAssignment}
          userId={teacherId}
          profile={profile}
          onClose={() => setCommentAssignment(null)}
        />
      )}
    </>
  )
}

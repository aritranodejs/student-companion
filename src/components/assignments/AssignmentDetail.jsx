import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { HiOutlinePaperClip, HiOutlineChat, HiOutlineUpload } from 'react-icons/hi'
import { supabase } from '../../lib/supabase'
import { notify } from '../../lib/notify.jsx'
import Modal from '../ui/Modal'

export default function AssignmentDetail({ assignment, userId, profile, onClose, onUpdated }) {
  const [submission, setSubmission] = useState(null)
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [studentNote, setStudentNote] = useState('')
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)

  const isStudent = profile?.role === 'student'

  useEffect(() => {
    loadData()
  }, [assignment.id])

  const loadData = async () => {
    setLoading(true)
    const [subRes, comRes] = await Promise.all([
      supabase.from('assignment_submissions').select('*').eq('assignment_id', assignment.id).eq('student_id', isStudent ? userId : submission?.student_id || userId).maybeSingle(),
      supabase.from('assignment_comments').select('*, author:profiles!assignment_comments_user_id_fkey(name, role)').eq('assignment_id', assignment.id).order('created_at'),
    ])
    setSubmission(subRes.data)
    setStudentNote(subRes.data?.student_comment || '')
    setComments(comRes.data || [])
    setLoading(false)
  }

  const loadComments = async () => {
    const { data } = await supabase
      .from('assignment_comments')
      .select('*, author:profiles!assignment_comments_user_id_fkey(name, role)')
      .eq('assignment_id', assignment.id)
      .order('created_at')
    setComments(data || [])
  }

  const uploadFile = async () => {
    if (!file || !isStudent) return null
    const ext = file.name.split('.').pop()
    const path = `${userId}/${assignment.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('submissions').upload(path, file, { upsert: true })
    if (error) throw error
    return { path, name: file.name }
  }

  const hasExistingFile = !!submission?.file_url
  const canTurnIn = !!file || hasExistingFile

  const handleSubmitWork = async () => {
    if (!isStudent) return

    if (!canTurnIn) {
      notify.error('Please attach a file before turning in your assignment')
      return
    }

    setUploading(true)
    try {
      let fileUrl = submission?.file_url
      let fileName = submission?.file_name
      if (file) {
        const uploaded = await uploadFile()
        fileUrl = uploaded.path
        fileName = uploaded.name
      }
      const payload = {
        assignment_id: assignment.id,
        student_id: userId,
        status: 'completed',
        student_comment: studentNote || null,
        file_url: fileUrl || null,
        file_name: fileName || null,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const { error } = await supabase
        .from('assignment_submissions')
        .upsert(payload, { onConflict: 'assignment_id,student_id' })
      if (error) throw error
      notify.success('Work submitted!')
      await loadData()
      onUpdated?.()
    } catch (err) {
      notify.error(err.message || 'Submit failed')
    } finally {
      setUploading(false)
    }
  }

  const handlePostComment = async () => {
    if (!commentText.trim()) return
    const { error } = await supabase.from('assignment_comments').insert({
      assignment_id: assignment.id,
      submission_id: submission?.id || null,
      user_id: userId,
      content: commentText.trim(),
    })
    if (error) notify.error(error.message)
    else {
      setCommentText('')
      await loadComments()
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={assignment.title}>
      <div className="max-h-[70vh] space-y-5 overflow-y-auto">
        <div>
          <p className="text-sm text-indigo-600">{assignment.subject}</p>
          <p className="text-xs text-slate-500">Due {format(new Date(assignment.due_date), 'MMM d, yyyy')}</p>
          {assignment.description && <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{assignment.description}</p>}
        </div>

        {loading ? (
          <div className="skeleton h-24 w-full rounded-xl" />
        ) : isStudent && (
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><HiOutlineUpload /> Your Work</h3>
            {submission?.file_url && (
              <button
                type="button"
                onClick={async () => {
                  const { data } = await supabase.storage.from('submissions').createSignedUrl(submission.file_url, 3600)
                  if (data?.signedUrl) window.open(data.signedUrl, '_blank')
                }}
                className="mb-3 flex items-center gap-2 text-sm text-indigo-600 hover:underline"
              >
                <HiOutlinePaperClip /> {submission.file_name || 'View submitted file'}
              </button>
            )}
            <input type="file" required={!submission?.file_url} onChange={(e) => setFile(e.target.files?.[0] || null)} className="mb-3 block w-full text-sm" accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,.jpg,.jpeg,.png" />
            <p className="mb-3 text-xs text-slate-500">File upload is required to turn in this assignment.</p>
            <textarea value={studentNote} onChange={(e) => setStudentNote(e.target.value)} className="input-field mb-3" rows={2} placeholder="Add a note for your teacher (optional)" />
            <button onClick={handleSubmitWork} disabled={uploading || !canTurnIn} className="btn-primary w-full disabled:opacity-50">
              {uploading ? 'Uploading...' : submission?.submitted_at ? 'Update Submission' : 'Turn In Assignment'}
            </button>
            {submission?.submitted_at && (
              <p className="mt-2 text-xs text-slate-400">Submitted {format(new Date(submission.submitted_at), 'MMM d, yyyy h:mm a')}</p>
            )}
            {submission?.teacher_feedback && (
              <div className="mt-3 rounded-lg bg-indigo-50 p-3 text-sm dark:bg-indigo-950/30">
                <p className="font-medium text-indigo-700 dark:text-indigo-300">Teacher feedback</p>
                <p className="mt-1 text-slate-600 dark:text-slate-400">{submission.teacher_feedback}</p>
              </div>
            )}
          </div>
        )}

        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><HiOutlineChat /> Class Comments</h3>
          <div className="mb-3 max-h-40 space-y-2 overflow-y-auto">
            {comments.length === 0 && <p className="text-xs text-slate-400">No comments yet</p>}
            {comments.map((c) => (
              <div key={c.id} className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {c.author?.name || 'User'}
                  <span className="ml-2 text-slate-400">{c.author?.role}</span>
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">{c.content}</p>
                <p className="text-xs text-slate-400">{format(new Date(c.created_at), 'MMM d, h:mm a')}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={commentText} onChange={(e) => setCommentText(e.target.value)} className="input-field flex-1" placeholder="Add a comment..." onKeyDown={(e) => e.key === 'Enter' && handlePostComment()} />
            <button onClick={handlePostComment} className="btn-primary shrink-0">Post</button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

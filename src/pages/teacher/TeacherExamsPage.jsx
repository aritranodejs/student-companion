import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useAuthStore } from '../../stores'
import { useInstitutionStore } from '../../stores/institution'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/ui/Modal'
import { notify } from '../../lib/notify.jsx'
import { useConfirm } from '../../components/ui/ConfirmProvider'
import { HiOutlinePlus, HiOutlineTrash } from 'react-icons/hi'

export default function TeacherExamsPage() {
  const user = useAuthStore((s) => s.user)
  const { classes, fetchTeacherClasses, createClassExam } = useInstitutionStore()
  const [exams, setExams] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const form = useForm()
  const confirm = useConfirm()

  useEffect(() => {
    if (user?.id) { fetchTeacherClasses(user.id); loadExams() }
  }, [user?.id])

  const loadExams = async () => {
    const { data } = await supabase.from('exams').select('*, class:classes(name)').eq('created_by', user.id).not('class_id', 'is', null).order('exam_date')
    setExams(data || [])
  }

  const onSubmit = async (data) => {
    const { error } = await createClassExam({ ...data, class_id: data.class_id }, user.id)
    if (error) notify.error(error.message)
    else { setModalOpen(false); form.reset(); loadExams() }
  }

  const handleDelete = async (exam) => {
    const ok = await confirm({
      title: 'Delete Exam',
      message: `Remove "${exam.exam_name}" scheduled for ${exam.exam_date}? Students will no longer see this exam.`,
      confirmLabel: 'Delete',
      variant: 'error',
    })
    if (!ok) return
    const { error } = await supabase.from('exams').delete().eq('id', exam.id)
    if (error) notify.error(error.message)
    else {
      notify.success('Exam deleted')
      loadExams()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Schedule Exams</h1>
          <p className="page-subtitle">Students receive exam countdown alerts automatically</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary"><HiOutlinePlus /> Schedule Exam</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {exams.map((e) => (
          <div key={e.id} className="glass-card-hover p-5">
            <div className="flex justify-between">
              <div>
                <h3 className="font-semibold">{e.exam_name}</h3>
                <p className="text-sm text-slate-500">{e.class?.name}</p>
                <p className="mt-2 text-indigo-600">{e.exam_date}</p>
              </div>
              <button type="button" onClick={() => handleDelete(e)} className="text-red-400 hover:text-red-600"><HiOutlineTrash /></button>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Schedule Exam">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div><label className="label-text">Class</label>
            <select {...form.register('class_id', { required: true })} className="input-field">
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label className="label-text">Exam Name</label><input {...form.register('exam_name', { required: true })} className="input-field" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label-text">Subject</label><input {...form.register('subject', { required: true })} className="input-field" /></div>
            <div><label className="label-text">Date</label><input type="date" {...form.register('exam_date', { required: true })} className="input-field" /></div>
          </div>
          <div><label className="label-text">Notes</label><textarea {...form.register('notes')} className="input-field" rows={2} /></div>
          <button type="submit" className="btn-primary w-full">Schedule & Notify</button>
        </form>
      </Modal>
    </div>
  )
}

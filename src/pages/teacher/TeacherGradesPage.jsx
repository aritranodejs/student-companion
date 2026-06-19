import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { HiOutlinePlus, HiOutlineTrash } from 'react-icons/hi'
import { useAuthStore } from '../../stores'
import { useInstitutionStore } from '../../stores/institution'
import { supabase } from '../../lib/supabase'
import { calcGPA } from '../../utils/helpers'
import { GRADES } from '../../constants'
import Modal from '../../components/ui/Modal'
import { notify } from '../../lib/notify.jsx'

export default function TeacherGradesPage() {
  const user = useAuthStore((s) => s.user)
  const { classes, fetchTeacherClasses } = useInstitutionStore()
  const [selectedClass, setSelectedClass] = useState('')
  const [students, setStudents] = useState([])
  const [selectedStudent, setSelectedStudent] = useState('')
  const [semesters, setSemesters] = useState([])
  const [semModal, setSemModal] = useState(false)
  const [subModal, setSubModal] = useState(false)
  const [activeSemester, setActiveSemester] = useState(null)
  const semForm = useForm()
  const subForm = useForm()

  useEffect(() => {
    if (user?.id) fetchTeacherClasses(user.id)
  }, [user?.id])

  useEffect(() => {
    if (selectedClass) loadStudents()
  }, [selectedClass])

  useEffect(() => {
    if (selectedStudent) loadSemesters()
  }, [selectedStudent])

  const loadStudents = async () => {
    const { data } = await supabase.from('class_enrollments').select('student_id').eq('class_id', selectedClass)
    const ids = (data || []).map((e) => e.student_id)
    const { data: profiles } = await supabase.from('profiles').select('id, name, roll_number').in('id', ids)
    setStudents(profiles || [])
    setSelectedStudent('')
    setSemesters([])
  }

  const loadSemesters = async () => {
    const { data } = await supabase
      .from('semesters')
      .select('*, subjects(*)')
      .eq('student_id', selectedStudent)
      .order('created_at')
    setSemesters(data || [])
  }

  const handleAddSemester = async (data) => {
    const student = students.find((s) => s.id === selectedStudent)
    const { data: row, error } = await supabase.from('semesters').insert({
      semester_name: data.semester_name,
      gpa: 0,
      user_id: selectedStudent,
      student_id: selectedStudent,
      published_by: user.id,
      class_id: selectedClass,
    }).select().single()
    if (error) notify.error(error.message)
    else {
      notify.success(`Semester added for ${student?.name}`)
      setSemModal(false)
      semForm.reset()
      loadSemesters()
    }
  }

  const handleAddSubject = async (data) => {
    const { error } = await supabase.from('subjects').insert({
      semester_id: activeSemester,
      subject_name: data.subject_name,
      credits: Number(data.credits),
      grade: data.grade,
    })
    if (error) notify.error(error.message)
    else {
      const sem = semesters.find((s) => s.id === activeSemester)
      const updated = [...(sem?.subjects || []), { credits: Number(data.credits), grade: data.grade }]
      const gpa = calcGPA(updated)
      await supabase.from('semesters').update({ gpa }).eq('id', activeSemester)
      notify.success('Subject grade published')
      setSubModal(false)
      subForm.reset()
      loadSemesters()
    }
  }

  const handleDeleteSemester = async (id) => {
    if (!confirm('Delete this semester record?')) return
    await supabase.from('semesters').delete().eq('id', id)
    loadSemesters()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Publish Grades</h1>
        <p className="page-subtitle">Add semester results for students — they see it read-only in CGPA</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="input-field">
          <option value="">Select class...</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)} className="input-field" disabled={!selectedClass}>
          <option value="">Select student...</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.roll_number || s.id.slice(0, 8)})</option>)}
        </select>
      </div>

      {selectedStudent && (
        <>
          <button onClick={() => { semForm.reset(); setSemModal(true) }} className="btn-primary">
            <HiOutlinePlus /> Add Semester
          </button>
          <div className="space-y-4">
            {semesters.map((sem) => (
              <div key={sem.id} className="glass-card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{sem.semester_name}</h3>
                    <p className="text-sm text-slate-500">GPA: {sem.gpa}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setActiveSemester(sem.id); subForm.reset(); setSubModal(true) }} className="btn-secondary text-xs">Add Subject</button>
                    <button onClick={() => handleDeleteSemester(sem.id)} className="text-red-400"><HiOutlineTrash className="h-5 w-5" /></button>
                  </div>
                </div>
                {(sem.subjects || []).length > 0 && (
                  <table className="mt-4 w-full text-sm">
                    <thead><tr className="text-left text-xs text-slate-500"><th>Subject</th><th>Credits</th><th>Grade</th></tr></thead>
                    <tbody>
                      {sem.subjects.map((sub) => (
                        <tr key={sub.id} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="py-2">{sub.subject_name}</td>
                          <td>{sub.credits}</td>
                          <td>{sub.grade}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <Modal isOpen={semModal} onClose={() => setSemModal(false)} title="Add Semester">
        <form onSubmit={semForm.handleSubmit(handleAddSemester)} className="space-y-4">
          <input {...semForm.register('semester_name', { required: true })} className="input-field" placeholder="Semester 1" />
          <button type="submit" className="btn-primary w-full">Publish Semester</button>
        </form>
      </Modal>

      <Modal isOpen={subModal} onClose={() => setSubModal(false)} title="Add Subject Grade">
        <form onSubmit={subForm.handleSubmit(handleAddSubject)} className="space-y-4">
          <input {...subForm.register('subject_name', { required: true })} className="input-field" placeholder="Subject name" />
          <div className="grid grid-cols-2 gap-4">
            <input type="number" min="1" {...subForm.register('credits', { required: true })} className="input-field" placeholder="Credits" />
            <select {...subForm.register('grade', { required: true })} className="input-field">{GRADES.map((g) => <option key={g} value={g}>{g}</option>)}</select>
          </div>
          <button type="submit" className="btn-primary w-full">Publish Grade</button>
        </form>
      </Modal>
    </div>
  )
}

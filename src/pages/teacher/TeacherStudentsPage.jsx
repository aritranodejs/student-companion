import { useEffect, useState } from 'react'
import { HiOutlineSearch, HiOutlinePencil, HiOutlineEye } from 'react-icons/hi'
import { useAuthStore } from '../../stores'
import { useInstitutionStore } from '../../stores/institution'
import UserEditModal from '../../components/admin/UserEditModal'
import Modal from '../../components/ui/Modal'
import StudentIdentityCard from '../../components/attendance/StudentIdentityCard'
import { Avatar } from '../../components/attendance/StudentIdentityCard'
import { notify } from '../../lib/notify.jsx'

function userDeptCourse(u, departments, courses) {
  if (u.course_id) {
    const course = courses.find((c) => c.id === u.course_id)
    if (course) return `${course.department?.code} → ${course.code}`
  }
  const dept = departments.find((d) => d.id === u.department_id)
  return dept?.name || '—'
}

export default function TeacherStudentsPage() {
  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const { departments, courses, fetchTeacherReferenceData, fetchTeacherDeptStudents, updateUserProfile } = useInstitutionStore()
  const [students, setStudents] = useState([])
  const [search, setSearch] = useState('')
  const [editUser, setEditUser] = useState(null)
  const [viewUser, setViewUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.id) load()
  }, [user?.id])

  const load = async () => {
    setLoading(true)
    await fetchTeacherReferenceData(user.id)
    const list = await fetchTeacherDeptStudents(user.id)
    setStudents(list)
    setLoading(false)
  }

  const filtered = students.filter((s) =>
    s.name?.toLowerCase().includes(search.toLowerCase())
    || s.email?.toLowerCase().includes(search.toLowerCase())
    || s.roll_number?.toLowerCase().includes(search.toLowerCase())
  )

  const handleSave = async (payload) => {
    const { error } = await updateUserProfile(editUser.id, payload, profile)
    if (error) notify.error(error.message)
    else {
      setEditUser(null)
      load()
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Department Students</h1>
        <p className="page-subtitle">Profile photos, attendance face mapping, and student records</p>
      </div>

      {!profile?.department_id && (
        <div className="glass-card border-amber-200 bg-amber-50/50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/20">
          Your profile has no department assigned. Ask admin to set your department first.
        </div>
      )}

      <div className="relative max-w-md">
        <HiOutlineSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search students..." className="input-field pl-10" />
      </div>

      {loading ? (
        <div className="skeleton h-48 w-full rounded-2xl" />
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-slate-500">No students in your department yet.</p>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-left text-xs uppercase text-slate-500 dark:border-slate-800">
                <th className="px-5 py-3">Student</th>
                <th className="px-5 py-3">Attendance Face</th>
                <th className="px-5 py-3">Roll No.</th>
                <th className="px-5 py-3">Admitted Course</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const hasFace = !!s.face_descriptor || !!s.face_image_url
                return (
                  <tr key={s.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar url={s.avatar_url} name={s.name} size="sm" />
                        <div>
                          <p className="font-medium">{s.name}</p>
                          <p className="text-xs text-slate-500">{s.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {s.face_image_url ? (
                        <img src={s.face_image_url} alt="" className="h-10 w-10 rounded-lg object-cover ring-1 ring-emerald-200" />
                      ) : (
                        <span className={`text-xs font-medium ${hasFace ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {hasFace ? 'Registered' : 'Not set'}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-500">{s.roll_number || '—'}</td>
                    <td className="px-5 py-4 text-slate-500">{userDeptCourse(s, departments, courses)}</td>
                    <td className="px-5 py-4">
                      <div className="flex gap-3">
                        <button type="button" onClick={() => setViewUser(s)} className="inline-flex items-center gap-1 text-indigo-600 hover:underline">
                          <HiOutlineEye className="h-4 w-4" /> View
                        </button>
                        <button type="button" onClick={() => setEditUser(s)} className="inline-flex items-center gap-1 text-indigo-600 hover:underline">
                          <HiOutlinePencil className="h-4 w-4" /> Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editUser && (
        <UserEditModal
          user={editUser}
          departments={departments.filter((d) => d.id === profile?.department_id)}
          courses={courses.filter((c) => c.department_id === profile?.department_id)}
          lockDepartment
          canEditRole={false}
          onClose={() => setEditUser(null)}
          onSave={handleSave}
        />
      )}

      <Modal isOpen={!!viewUser} onClose={() => setViewUser(null)} title="Student Profile" size="lg">
        {viewUser && <StudentIdentityCard student={viewUser} />}
      </Modal>
    </div>
  )
}

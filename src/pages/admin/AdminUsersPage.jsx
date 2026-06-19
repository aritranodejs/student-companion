import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { HiOutlineSearch } from 'react-icons/hi'
import { useInstitutionStore } from '../../stores/institution'
import RoleBadge from '../../components/ui/RoleBadge'
import { ROLE_LABELS, ROLES } from '../../constants/roles'
import { notify } from '../../lib/notify.jsx'

function userDeptCourse(u, departments, courses) {
  if (u.course_id) {
    const course = courses.find((c) => c.id === u.course_id)
    if (course) return `${course.department?.code || '—'} → ${course.code}`
  }
  if (u.department_id) {
    const dept = departments.find((d) => d.id === u.department_id)
    if (dept) return dept.name
  }
  return u.department || '—'
}

export default function AdminUsersPage() {
  const { allUsers, departments, courses, loading, fetchAdminData, updateUserRole } = useInstitutionStore()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => { fetchAdminData() }, [fetchAdminData])

  const filtered = allUsers.filter((u) => {
    const matchSearch = u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
    const matchRole = filter === 'all' || u.role === filter
    return matchSearch && matchRole
  })

  const handleRoleChange = async (userId, role) => {
    const { error } = await updateUserRole(userId, role)
    if (error) notify.error(error.message)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">User Management</h1>
        <p className="page-subtitle">Assign roles — Admin, Teacher, or Student</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <HiOutlineSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..." className="input-field pl-10" />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="input-field w-auto">
          <option value="all">All Roles</option>
          {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="skeleton h-64 w-full rounded-2xl" />
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/30">
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Roll No.</th>
                <th className="px-5 py-3">Dept / Course</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Change Role</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <motion.tr
                  key={u.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-slate-100 dark:border-slate-800"
                >
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900 dark:text-white">{u.name}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-500">{u.roll_number || '—'}</td>
                  <td className="px-5 py-4 text-slate-500">{userDeptCourse(u, departments, courses)}</td>
                  <td className="px-5 py-4"><RoleBadge role={u.role} /></td>
                  <td className="px-5 py-4">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      className="input-field w-32 py-1.5 text-xs"
                    >
                      {Object.values(ROLES).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

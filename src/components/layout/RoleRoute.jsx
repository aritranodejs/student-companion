import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../stores'
import { ROLES } from '../../constants/roles'

export default function RoleRoute({ allowedRoles, children }) {
  const profile = useAuthStore((s) => s.profile)
  const loading = useAuthStore((s) => s.loading)
  const role = profile?.role || ROLES.STUDENT

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    )
  }

  if (!allowedRoles.includes(role)) {
    if (role === ROLES.ADMIN) return <Navigate to="/admin" replace />
    if (role === ROLES.TEACHER) return <Navigate to="/teacher" replace />
    return <Navigate to="/" replace />
  }

  return children
}

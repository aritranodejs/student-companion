import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useEffect } from 'react'
import { useAuthStore } from './stores'
import useAppData from './hooks/useAppData'
import AppLayout from './components/layout/AppLayout'
import ProtectedRoute from './components/layout/ProtectedRoute'
import RoleRoute from './components/layout/RoleRoute'
import { ConfirmProvider } from './components/ui/ConfirmProvider'
import { ROLES } from './constants/roles'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import DashboardPage from './pages/DashboardPage'
import AttendancePage from './pages/AttendancePage'
import AssignmentsPage from './pages/AssignmentsPage'
import CGPAPage from './pages/CGPAPage'
import StudyPage from './pages/StudyPage'
import ExamsPage from './pages/ExamsPage'
import GoalsPage from './pages/GoalsPage'
import ProfilePage from './pages/ProfilePage'
import SettingsPage from './pages/SettingsPage'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminDepartmentsPage from './pages/admin/AdminDepartmentsPage'
import AdminCoursesPage from './pages/admin/AdminCoursesPage'
import AdminUsersPage from './pages/admin/AdminUsersPage'
import AdminClassesPage from './pages/admin/AdminClassesPage'
import AdminAttendancePage from './pages/admin/AdminAttendancePage'
import TeacherDashboard from './pages/teacher/TeacherDashboard'
import TeacherAssignmentsPage from './pages/teacher/TeacherAssignmentsPage'
import TeacherAttendancePage from './pages/teacher/TeacherAttendancePage'
import TeacherExamsPage from './pages/teacher/TeacherExamsPage'
import TeacherGradesPage from './pages/teacher/TeacherGradesPage'
import TeacherStudentsPage from './pages/teacher/TeacherStudentsPage'
import TeacherClassesPage from './pages/teacher/TeacherClassesPage'
import AttendanceMobilePage from './pages/AttendanceMobilePage'
import FaceRegisterMobilePage from './pages/FaceRegisterMobilePage'

function AppRoutes() {
  useAppData()

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/face-register/mobile/:token" element={<FaceRegisterMobilePage />} />
      <Route path="/attendance/mobile/:token" element={<AttendanceMobilePage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Routes>
                {/* Admin routes */}
                <Route path="/admin" element={<RoleRoute allowedRoles={[ROLES.ADMIN]}><AdminDashboard /></RoleRoute>} />
                <Route path="/admin/departments" element={<RoleRoute allowedRoles={[ROLES.ADMIN]}><AdminDepartmentsPage /></RoleRoute>} />
                <Route path="/admin/courses" element={<RoleRoute allowedRoles={[ROLES.ADMIN]}><AdminCoursesPage /></RoleRoute>} />
                <Route path="/admin/users" element={<RoleRoute allowedRoles={[ROLES.ADMIN]}><AdminUsersPage /></RoleRoute>} />
                <Route path="/admin/classes" element={<RoleRoute allowedRoles={[ROLES.ADMIN]}><AdminClassesPage /></RoleRoute>} />
                <Route path="/admin/attendance" element={<RoleRoute allowedRoles={[ROLES.ADMIN]}><AdminAttendancePage /></RoleRoute>} />

                {/* Teacher routes */}
                <Route path="/teacher" element={<RoleRoute allowedRoles={[ROLES.TEACHER]}><TeacherDashboard /></RoleRoute>} />
                <Route path="/teacher/classes" element={<RoleRoute allowedRoles={[ROLES.TEACHER]}><TeacherClassesPage /></RoleRoute>} />
                <Route path="/teacher/students" element={<RoleRoute allowedRoles={[ROLES.TEACHER]}><TeacherStudentsPage /></RoleRoute>} />
                <Route path="/teacher/assignments" element={<RoleRoute allowedRoles={[ROLES.TEACHER]}><TeacherAssignmentsPage /></RoleRoute>} />
                <Route path="/teacher/grades" element={<RoleRoute allowedRoles={[ROLES.TEACHER]}><TeacherGradesPage /></RoleRoute>} />
                <Route path="/teacher/attendance" element={<RoleRoute allowedRoles={[ROLES.TEACHER]}><TeacherAttendancePage /></RoleRoute>} />
                <Route path="/teacher/exams" element={<RoleRoute allowedRoles={[ROLES.TEACHER]}><TeacherExamsPage /></RoleRoute>} />

                {/* Student routes */}
                <Route path="/" element={<RoleRoute allowedRoles={[ROLES.STUDENT]}><DashboardPage /></RoleRoute>} />
                <Route path="/attendance" element={<RoleRoute allowedRoles={[ROLES.STUDENT]}><AttendancePage /></RoleRoute>} />
                <Route path="/assignments" element={<RoleRoute allowedRoles={[ROLES.STUDENT]}><AssignmentsPage /></RoleRoute>} />
                <Route path="/cgpa" element={<RoleRoute allowedRoles={[ROLES.STUDENT]}><CGPAPage /></RoleRoute>} />
                <Route path="/study" element={<RoleRoute allowedRoles={[ROLES.STUDENT]}><StudyPage /></RoleRoute>} />
                <Route path="/exams" element={<RoleRoute allowedRoles={[ROLES.STUDENT]}><ExamsPage /></RoleRoute>} />
                <Route path="/goals" element={<RoleRoute allowedRoles={[ROLES.STUDENT]}><GoalsPage /></RoleRoute>} />

                {/* Shared */}
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default function App() {
  const initialize = useAuthStore((s) => s.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <BrowserRouter>
      <ConfirmProvider>
        <AppRoutes />
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      </ConfirmProvider>
    </BrowserRouter>
  )
}

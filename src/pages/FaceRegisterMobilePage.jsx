import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { HiOutlineCamera, HiOutlineShieldCheck } from 'react-icons/hi'
import { useAuthStore } from '../stores'
import { useInstitutionStore } from '../stores/institution'
import FaceCapture from '../components/attendance/FaceCapture'
import AlertModal from '../components/ui/AlertModal'
import { notify } from '../lib/notify.jsx'
import { supabase } from '../lib/supabase'

export default function FaceRegisterMobilePage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const fetchProfile = useAuthStore((s) => s.fetchProfile)
  const { saveFaceDescriptor, completeFaceRegistrationHandoff } = useInstitutionStore()

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [handoff, setHandoff] = useState(null)
  const [error, setError] = useState('')
  const [successModal, setSuccessModal] = useState(false)

  useEffect(() => {
    if (user?.id) fetchProfile(user.id)
  }, [user?.id, fetchProfile])

  useEffect(() => {
    loadHandoff()
  }, [token, user?.id])

  const loadHandoff = async () => {
    if (!token) return
    setLoading(true)
    setError('')

    const { data: row, error: fetchErr } = await supabase
      .from('face_registration_handoff_tokens')
      .select('*')
      .eq('id', token)
      .single()

    if (fetchErr || !row) {
      setError('Invalid or expired QR code.')
      setLoading(false)
      return
    }

    if (user?.id && row.student_id !== user.id) {
      setError('This QR code belongs to another student. Log in with your own account.')
      setLoading(false)
      return
    }

    if (row.status !== 'pending') {
      setError(row.status === 'completed' ? 'Face already registered from this QR code.' : 'This QR code has expired.')
      setLoading(false)
      return
    }

    if (new Date(row.expires_at) < new Date()) {
      await supabase.from('face_registration_handoff_tokens').update({ status: 'expired' }).eq('id', token).eq('status', 'pending')
      setError('This QR code has expired. Generate a new one from your PC.')
      setLoading(false)
      return
    }

    setHandoff(row)
    setLoading(false)
  }

  const handleRegister = async (descriptor, snapshot) => {
    if (!handoff || !user) return
    setBusy(true)
    const { error } = await saveFaceDescriptor(user.id, descriptor, snapshot)
    if (error) {
      notify.error(error.message)
      setBusy(false)
      return
    }
    await completeFaceRegistrationHandoff(handoff.id)
    await fetchProfile(user.id)
    setSuccessModal(true)
    setBusy(false)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-600 to-purple-700 p-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-white border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-600 to-purple-700 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl dark:bg-slate-900">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <Link to="/attendance" className="btn-primary mt-6 inline-block">Go to Attendance</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 p-4 pb-8">
      <div className="mx-auto max-w-md">
        <div className="mb-6 text-center text-white">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur">
            <HiOutlineShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-bold">Register Your Face</h1>
          <p className="mt-1 text-sm text-indigo-100">One-time setup for attendance verification</p>
        </div>

        <div className="glass-card p-5">
          {profile?.face_descriptor ? (
            <div className="text-center">
              <p className="text-sm text-emerald-600">You already have a face registered.</p>
              <button type="button" onClick={() => navigate('/attendance')} className="btn-primary mt-4 w-full">
                Go to Attendance
              </button>
            </div>
          ) : (
            <>
              <p className="mb-4 flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-xs text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-200">
                <HiOutlineCamera /> Position your face in the frame and tap save
              </p>
              <FaceCapture
                mode="register"
                label={busy ? 'Saving…' : 'Save Face Profile'}
                disabled={busy}
                onCapture={handleRegister}
              />
            </>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-indigo-200">
          Logged in as {profile?.name || user?.email}
        </p>
      </div>

      <AlertModal
        isOpen={successModal}
        onClose={() => navigate('/attendance')}
        title="Face Registered"
        message="Your attendance face is saved. You can mark attendance from your PC using QR."
        variant="success"
      />
    </div>
  )
}

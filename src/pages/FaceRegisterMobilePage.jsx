import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { HiOutlineCamera, HiOutlineShieldCheck } from 'react-icons/hi'
import FaceCapture from '../components/attendance/FaceCapture'
import AlertModal from '../components/ui/AlertModal'
import { notify } from '../lib/notify.jsx'
import { fetchFaceRegistrationHandoff, submitFaceRegistrationHandoff } from '../lib/handoffApi'

export default function FaceRegisterMobilePage() {
  const { token } = useParams()

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [handoff, setHandoff] = useState(null)
  const [studentName, setStudentName] = useState('')
  const [hasFace, setHasFace] = useState(false)
  const [error, setError] = useState('')
  const [successModal, setSuccessModal] = useState(false)

  useEffect(() => {
    loadHandoff()
  }, [token])

  const loadHandoff = async () => {
    if (!token) return
    setLoading(true)
    setError('')

    const result = await fetchFaceRegistrationHandoff(token)
    if (!result.ok) {
      setError(result.error)
      setLoading(false)
      return
    }

    setHandoff(result.handoff)
    setStudentName(result.student?.name || 'Student')
    setHasFace(!!result.student?.has_face)
    setLoading(false)
  }

  const handleRegister = async (descriptor) => {
    if (!handoff || !token) return
    setBusy(true)
    const result = await submitFaceRegistrationHandoff(token, descriptor)
    if (!result.ok) {
      notify.error(result.error)
      setBusy(false)
      return
    }
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
          <p className="mt-4 text-xs text-slate-500">Scan a fresh QR code from your PC to try again.</p>
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
          <p className="mt-1 text-sm text-indigo-100">No login needed — scan completed on your phone</p>
        </div>

        <div className="glass-card p-5">
          {hasFace ? (
            <div className="text-center">
              <p className="text-sm text-emerald-600">Face already registered for {studentName}.</p>
              <p className="mt-2 text-xs text-slate-500">You can close this page and mark attendance from your PC.</p>
            </div>
          ) : (
            <>
              <p className="mb-1 text-center text-sm font-medium text-slate-700 dark:text-slate-200">{studentName}</p>
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
      </div>

      <AlertModal
        isOpen={successModal}
        onClose={() => setSuccessModal(false)}
        title="Face Registered"
        message="Your attendance face is saved. Return to your PC — it will update automatically."
        variant="success"
      />
    </div>
  )
}

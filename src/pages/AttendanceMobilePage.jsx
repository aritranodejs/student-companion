import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { HiOutlineLocationMarker, HiOutlineShieldCheck } from 'react-icons/hi'
import { getCurrentCoords } from '../lib/geo'
import { buildAttendancePayload } from '../lib/attendanceMark'
import { fetchAttendanceHandoff, submitAttendanceHandoff } from '../lib/handoffApi'
import FaceCapture from '../components/attendance/FaceCapture'
import AlertModal from '../components/ui/AlertModal'
import { notify } from '../lib/notify.jsx'

export default function AttendanceMobilePage() {
  const { token } = useParams()

  const [handoff, setHandoff] = useState(null)
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(false)
  const [coords, setCoords] = useState(null)
  const [locLoading, setLocLoading] = useState(false)
  const [successModal, setSuccessModal] = useState(false)
  const [successClass, setSuccessClass] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    loadHandoff()
  }, [token])

  const loadHandoff = async () => {
    if (!token) return
    setLoading(true)
    setError('')

    const result = await fetchAttendanceHandoff(token)
    if (!result.ok) {
      setError(result.error)
      setLoading(false)
      return
    }

    if (result.existing_log_id) {
      setError('You already marked attendance for this class today.')
      setLoading(false)
      return
    }

    const sess = result.session
    setHandoff(result.handoff)
    setSession(sess)
    setProfile(result.profile)
    setLoading(false)

    if (sess?.require_location) {
      setLocLoading(true)
      try {
        const c = await getCurrentCoords()
        setCoords(c)
      } catch (err) {
        notify.error(err.message || 'Enable GPS on your phone')
      } finally {
        setLocLoading(false)
      }
    }
  }

  const handleVerify = async (descriptor) => {
    if (!session || !handoff || !token) return
    setMarking(true)

    const result = await buildAttendancePayload({
      session,
      profile,
      liveDescriptor: descriptor,
      coords,
      method: 'mobile',
      existingLog: null,
    })

    if (result.error) {
      notify.error(result.error.message)
      setMarking(false)
      return
    }

    const submit = await submitAttendanceHandoff(token, result.payload)
    if (!submit.ok) {
      notify.error(submit.error)
      setMarking(false)
      return
    }

    setSuccessClass(submit.class_name || session?.class?.name || 'Class')
    setSuccessModal(true)
    setMarking(false)
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
          <h1 className="text-xl font-bold">Mobile Attendance</h1>
          <p className="mt-1 text-sm text-indigo-100">{session?.class?.name}</p>
          <p className="text-xs text-indigo-200">{session?.class?.code}</p>
          <p className="mt-2 text-xs text-indigo-200/80">No login needed on this phone</p>
        </div>

        <div className="glass-card p-5">
          {!profile?.face_descriptor ? (
            <p className="text-center text-sm text-amber-600">
              Register your face first (from PC or phone QR), then scan this attendance QR again.
            </p>
          ) : (
            <>
              {session?.require_location && (
                <p className={`mb-4 flex items-center gap-2 rounded-xl px-3 py-2 text-xs ${coords ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30'}`}>
                  <HiOutlineLocationMarker />
                  {locLoading ? 'Getting GPS…' : coords ? 'GPS ready — verify your face below' : 'Enable location permission and refresh'}
                </p>
              )}
              {!locLoading && session?.require_location && !coords && (
                <button type="button" onClick={loadHandoff} className="btn-secondary mb-4 w-full text-sm">Retry GPS</button>
              )}
              <FaceCapture
                mode="verify"
                autoCapture
                referenceDescriptor={profile.face_descriptor}
                label={marking ? 'Marking…' : 'Verify Face & Mark Present'}
                disabled={marking || (session?.require_location && !coords)}
                onCapture={handleVerify}
              />
            </>
          )}
        </div>

        {profile?.name && (
          <p className="mt-4 text-center text-xs text-indigo-200">
            Marking for {profile.name}
          </p>
        )}
      </div>

      <AlertModal
        isOpen={successModal}
        onClose={() => setSuccessModal(false)}
        title="Attendance Marked"
        message={`${successClass} — verified from your phone. You can close this page.`}
        variant="success"
      />
    </div>
  )
}

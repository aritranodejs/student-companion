import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { HiOutlineLocationMarker, HiOutlineShieldCheck } from 'react-icons/hi'
import { useAuthStore } from '../stores'
import { useInstitutionStore } from '../stores/institution'
import { getCurrentCoords } from '../lib/geo'
import { buildAttendancePayload } from '../lib/attendanceMark'
import FaceCapture from '../components/attendance/FaceCapture'
import AlertModal from '../components/ui/AlertModal'
import { notify } from '../lib/notify.jsx'
import { supabase } from '../lib/supabase'

export default function AttendanceMobilePage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const fetchProfile = useAuthStore((s) => s.fetchProfile)
  const { markDailyAttendance, completeAttendanceHandoff } = useInstitutionStore()

  const [handoff, setHandoff] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(false)
  const [coords, setCoords] = useState(null)
  const [locLoading, setLocLoading] = useState(false)
  const [successModal, setSuccessModal] = useState(false)
  const [error, setError] = useState('')

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
      .from('attendance_handoff_tokens')
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
      setError(row.status === 'completed' ? 'Attendance already marked from this QR code.' : 'This QR code has expired.')
      setLoading(false)
      return
    }

    if (new Date(row.expires_at) < new Date()) {
      await supabase.from('attendance_handoff_tokens').update({ status: 'expired' }).eq('id', token).eq('status', 'pending')
      setError('This QR code has expired. Generate a new one from your PC.')
      setLoading(false)
      return
    }

    const { data: sess } = await supabase
      .from('attendance_sessions')
      .select('*, class:classes(id, name, code, campus_lat, campus_lng, campus_radius_m)')
      .eq('id', row.session_id)
      .single()

    if (!sess?.is_open) {
      setError('Attendance session is closed.')
      setLoading(false)
      return
    }

    setHandoff(row)
    setSession(sess)
    setLoading(false)

    if (sess.require_location) {
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
    if (!session || !handoff || !user) return
    setMarking(true)

    const { data: existing } = await supabase
      .from('attendance_logs')
      .select('id')
      .eq('session_id', session.id)
      .eq('student_id', user.id)
      .maybeSingle()

    const result = await buildAttendancePayload({
      session,
      profile,
      liveDescriptor: descriptor,
      coords,
      method: 'mobile',
      existingLog: existing,
    })

    if (result.error) {
      notify.error(result.error.message)
      setMarking(false)
      return
    }

    const { data: log, error: markErr } = await markDailyAttendance(result.payload, user.id, { silent: true })
    if (markErr) {
      notify.error(markErr.message)
      setMarking(false)
      return
    }

    await completeAttendanceHandoff(handoff.id, log?.id)
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
          <h1 className="text-xl font-bold">Mobile Attendance</h1>
          <p className="mt-1 text-sm text-indigo-100">{session?.class?.name}</p>
          <p className="text-xs text-indigo-200">{session?.class?.code}</p>
        </div>

        <div className="glass-card p-5">
          {!profile?.face_descriptor ? (
            <p className="text-center text-sm text-amber-600">Register your face on a device with a camera first, then scan again.</p>
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

        <p className="mt-4 text-center text-xs text-indigo-200">
          Logged in as {profile?.name || user?.email}
        </p>
      </div>

      <AlertModal
        isOpen={successModal}
        onClose={() => navigate('/attendance')}
        title="Attendance Marked"
        message={`${session?.class?.name} — verified from your phone.`}
        variant="success"
      />
    </div>
  )
}

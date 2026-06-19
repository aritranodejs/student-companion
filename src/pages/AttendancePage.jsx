import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { HiOutlineLocationMarker, HiOutlineCamera, HiOutlineCheckCircle, HiOutlineClock, HiOutlineExclamation } from 'react-icons/hi'
import { useAuthStore } from '../stores'
import { useInstitutionStore } from '../stores/institution'
import { compareDescriptors } from '../lib/faceRecognition'
import { getCurrentCoords, isWithinCampus } from '../lib/geo'
import { getCampusCoords, isCampusConfigured, canMarkAttendanceSession } from '../lib/institutionRules'
import { calcAttendancePercent, getAttendanceColor } from '../utils/helpers'
import FaceCapture from '../components/attendance/FaceCapture'
import Modal from '../components/ui/Modal'
import AlertModal from '../components/ui/AlertModal'
import { notify } from '../lib/notify.jsx'
import { supabase } from '../lib/supabase'

const colorMap = {
  green: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30',
  yellow: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30',
  red: 'text-red-600 bg-red-50 dark:bg-red-950/30',
}

export default function AttendancePage() {
  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const fetchProfile = useAuthStore((s) => s.fetchProfile)
  const {
    attendanceSessions, attendanceLogs,
    fetchStudentTodaySessions, fetchStudentAttendanceLogs,
    markDailyAttendance, saveFaceDescriptor,
  } = useInstitutionStore()

  const [faceModal, setFaceModal] = useState(false)
  const [markModal, setMarkModal] = useState(null)
  const [marking, setMarking] = useState(false)
  const [locLoading, setLocLoading] = useState(false)
  const [pendingCoords, setPendingCoords] = useState(null)
  const [classSummary, setClassSummary] = useState([])
  const [successModal, setSuccessModal] = useState(null)

  useEffect(() => {
    if (user?.id) {
      fetchStudentTodaySessions(user.id)
      fetchStudentAttendanceLogs(user.id)
      loadClassSummary()
    }
  }, [user?.id])

  const loadClassSummary = async () => {
    const { data } = await supabase
      .from('class_attendance')
      .select('*, class:classes(name, code)')
      .eq('student_id', user.id)
    setClassSummary(data || [])
  }

  const handleRegisterFace = async (descriptor, snapshot) => {
    const { error } = await saveFaceDescriptor(user.id, descriptor, snapshot)
    if (error) notify.error(error.message)
    else {
      await fetchProfile(user.id)
      setFaceModal(false)
      setSuccessModal({ title: 'Face Registered', message: 'Your attendance face is saved. You can now mark daily attendance.' })
    }
  }

  const handleMarkAttendance = async (session, liveDescriptor) => {
    setMarking(true)
    try {
      const sessionClass = session.class
      const precheck = canMarkAttendanceSession(session, sessionClass, !!profile?.face_descriptor)
      if (!precheck.ok) {
        notify.error(precheck.reason)
        return
      }

      let faceVerified = false
      let faceScore = null
      let locationVerified = false
      let latitude = null
      let longitude = null

      if (session.require_face) {
        if (!profile?.face_descriptor) {
          notify.error('Register your face first')
          setFaceModal(true)
          return
        }
        if (!liveDescriptor) {
          notify.error('Face verification required')
          return
        }
        const { match, score } = await compareDescriptors(profile.face_descriptor, liveDescriptor)
        faceVerified = match
        faceScore = score
        if (!match) {
          notify.error('Face verification failed. Try again in better lighting.')
          return
        }
      }

      if (session.require_location) {
        const { lat, lng, radius } = getCampusCoords(session, sessionClass)
        if (!isCampusConfigured(lat, lng)) {
          notify.error('Campus location is not set by your teacher. Attendance cannot be marked yet.')
          return
        }
        if (!pendingCoords) {
          notify.error('GPS location was not captured. Close and tap Mark Present again.')
          return
        }
        latitude = pendingCoords.latitude
        longitude = pendingCoords.longitude
        locationVerified = isWithinCampus(latitude, longitude, lat, lng, radius)
        if (!locationVerified) {
          notify.error(`You must be on campus (within ${radius}m) to mark attendance`)
          return
        }
      }

      const already = attendanceLogs.find((l) => l.session_id === session.id)
      if (already) {
        notify.info('You already marked attendance for this class today')
        return
      }

      let method = 'student_app'
      if (faceVerified && locationVerified) method = 'face'
      else if (faceVerified) method = 'face'
      else if (locationVerified) method = 'location'

      const { error } = await markDailyAttendance({
        session_id: session.id,
        class_id: session.class_id,
        status: 'present',
        method,
        latitude,
        longitude,
        face_match_score: faceScore,
        face_verified: faceVerified,
        location_verified: locationVerified,
      }, user.id)

      if (error) notify.error(error.message)
      else {
        setMarkModal(null)
        setPendingCoords(null)
        setSuccessModal({
          title: 'Attendance Marked',
          message: `${session.class?.name} — ${faceVerified ? 'Face verified' : ''}${faceVerified && locationVerified ? ' · ' : ''}${locationVerified ? 'GPS verified' : ''}`,
        })
        await loadClassSummary()
        await fetchStudentTodaySessions(user.id)
        await fetchStudentAttendanceLogs(user.id)
      }
    } catch (err) {
      notify.error(err.message || 'Could not mark attendance')
    } finally {
      setMarking(false)
    }
  }

  const openMarkModal = async (session) => {
    setPendingCoords(null)
    if (session.require_location) {
      setLocLoading(true)
      try {
        const coords = await getCurrentCoords()
        setPendingCoords(coords)
      } catch (err) {
        notify.error(err.message || 'Could not get your location')
        return
      } finally {
        setLocLoading(false)
      }
    }
    setMarkModal(session)
  }

  const hasFace = !!profile?.face_descriptor

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Mark Attendance</h1>
        <p className="page-subtitle">Premium face mapping + GPS verification for enrolled classes</p>
      </div>

      {!hasFace && (
        <div className="glass-card border-amber-200 bg-amber-50/50 p-5 dark:border-amber-900 dark:bg-amber-950/20">
          <div className="flex items-start gap-3">
            <HiOutlineCamera className="mt-0.5 h-6 w-6 text-amber-600" />
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900 dark:text-white">Register your face</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">One-time setup with live face mapping — required before marking daily attendance.</p>
              <button onClick={() => setFaceModal(true)} className="btn-primary mt-3">Register Face</button>
            </div>
          </div>
        </div>
      )}

      <div className="glass-card p-6">
        <h2 className="mb-4 flex items-center gap-2 font-semibold">
          <HiOutlineClock className="text-indigo-500" /> Today&apos;s Sessions
        </h2>
        {attendanceSessions.length === 0 ? (
          <p className="text-sm text-slate-500">No open attendance sessions. Your teacher will open one for today.</p>
        ) : (
          <div className="space-y-3">
            {attendanceSessions.map((session) => {
              const marked = attendanceLogs.some((l) => l.session_id === session.id)
              const check = canMarkAttendanceSession(session, session.class, hasFace)
              const { lat, lng } = getCampusCoords(session, session.class)
              const campusReady = !session.require_location || isCampusConfigured(lat, lng)

              return (
                <motion.div key={session.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">{session.class?.name}</p>
                      <p className="text-xs text-slate-500">{session.class?.code}</p>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-400">
                        {session.require_face && <span className="flex items-center gap-1"><HiOutlineCamera /> Face required</span>}
                        {session.require_location && (
                          <span className={`flex items-center gap-1 ${campusReady ? 'text-emerald-600' : 'text-amber-600'}`}>
                            <HiOutlineLocationMarker /> {campusReady ? 'GPS geofence active' : 'Campus GPS not set'}
                          </span>
                        )}
                      </div>
                      {!check.ok && !marked && (
                        <p className="mt-2 flex items-center gap-1 text-xs text-amber-600"><HiOutlineExclamation /> {check.reason}</p>
                      )}
                    </div>
                    {marked ? (
                      <span className="flex items-center gap-1 text-sm font-medium text-emerald-600"><HiOutlineCheckCircle /> Marked</span>
                    ) : (
                      <button
                        onClick={() => openMarkModal(session)}
                        disabled={!check.ok || locLoading}
                        className="btn-primary py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {locLoading ? 'Getting GPS…' : 'Mark Present'}
                      </button>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {classSummary.length > 0 && (
        <div className="glass-card p-6">
          <h2 className="mb-4 font-semibold">Class-wise Summary</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {classSummary.map((rec) => {
              const pct = calcAttendancePercent(rec.attended_classes, rec.total_classes)
              const color = getAttendanceColor(pct)
              return (
                <div key={rec.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                  <p className="font-medium">{rec.class?.name}</p>
                  <p className="text-xs text-slate-500">{rec.class?.code}</p>
                  <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${colorMap[color]}`}>{pct}%</span>
                  <p className="mt-1 text-xs text-slate-500">{rec.attended_classes}/{rec.total_classes} classes</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {attendanceLogs.length > 0 && (
        <div className="glass-card p-6">
          <h2 className="mb-4 font-semibold">Recent Logs</h2>
          <div className="space-y-2">
            {attendanceLogs.slice(0, 10).map((log) => (
              <div key={log.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2 text-sm dark:bg-slate-800/50">
                <span>{log.class?.name || 'Class'}</span>
                <span className="text-xs text-slate-500">
                  {new Date(log.marked_at).toLocaleString()} · {log.status}
                  {log.face_verified ? ' · ✓ face' : ''}
                  {log.location_verified ? ' · ✓ GPS' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal isOpen={faceModal} onClose={() => setFaceModal(false)} title="Register Your Face" size="lg">
        <FaceCapture mode="register" label="Save Face Profile" onCapture={handleRegisterFace} />
      </Modal>

      <Modal isOpen={!!markModal} onClose={() => { if (!marking) { setMarkModal(null); setPendingCoords(null) } }} title={`Verify Attendance — ${markModal?.class?.name || ''}`} size="lg">
        {markModal && !canMarkAttendanceSession(markModal, markModal.class, hasFace).ok ? (
          <p className="text-sm text-amber-600">{canMarkAttendanceSession(markModal, markModal.class, hasFace).reason}</p>
        ) : markModal?.require_face ? (
          <>
            {markModal.require_location && pendingCoords && (
              <p className="mb-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                <HiOutlineLocationMarker /> GPS captured — verify your face to complete
              </p>
            )}
            <FaceCapture
            mode="verify"
            autoCapture
            referenceDescriptor={profile?.face_descriptor}
            label={marking ? 'Verifying…' : 'Verify Face & Mark Present'}
            disabled={marking}
            onCapture={(descriptor) => handleMarkAttendance(markModal, descriptor)}
          />
          </>
        ) : null}
      </Modal>

      <AlertModal
        isOpen={!!successModal}
        onClose={() => setSuccessModal(null)}
        title={successModal?.title}
        message={successModal?.message}
        variant="success"
      />
    </div>
  )
}

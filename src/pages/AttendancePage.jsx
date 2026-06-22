import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  HiOutlineLocationMarker, HiOutlineCamera, HiOutlineCheckCircle,
  HiOutlineClock, HiOutlineExclamation, HiOutlineDeviceMobile,
} from 'react-icons/hi'
import { useAuthStore } from '../stores'
import { useInstitutionStore } from '../stores/institution'
import { getCurrentCoords } from '../lib/geo'
import { hasCamera } from '../lib/camera'
import { buildAttendancePayload } from '../lib/attendanceMark'
import { getCampusCoords, isCampusConfigured, canMarkAttendanceSession } from '../lib/institutionRules'
import { calcAttendancePercent, getAttendanceColor } from '../utils/helpers'
import FaceCapture from '../components/attendance/FaceCapture'
import AttendanceQRHandoff from '../components/attendance/AttendanceQRHandoff'
import FaceRegisterQRHandoff from '../components/attendance/FaceRegisterQRHandoff'
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
    markDailyAttendance, saveFaceDescriptor, createAttendanceHandoff, createFaceRegistrationHandoff,
  } = useInstitutionStore()

  const [faceModal, setFaceModal] = useState(false)
  const [faceRegMode, setFaceRegMode] = useState('camera')
  const [faceHandoffTokenId, setFaceHandoffTokenId] = useState(null)
  const [markModal, setMarkModal] = useState(null)
  const [markMode, setMarkMode] = useState('camera')
  const [handoffTokenId, setHandoffTokenId] = useState(null)
  const [cameraAvailable, setCameraAvailable] = useState(true)
  const [checkingCamera, setCheckingCamera] = useState(false)
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

  const refreshAfterMark = async (session) => {
    setMarkModal(null)
    setPendingCoords(null)
    setHandoffTokenId(null)
    setMarkMode('camera')
    setSuccessModal({
      title: 'Attendance Marked',
      message: `${session.class?.name} — attendance recorded successfully.`,
    })
    await loadClassSummary()
    await fetchStudentTodaySessions(user.id)
    await fetchStudentAttendanceLogs(user.id)
  }

  const handleMarkAttendance = async (session, liveDescriptor) => {
    setMarking(true)
    try {
      const already = attendanceLogs.find((l) => l.session_id === session.id)
      const result = await buildAttendancePayload({
        session,
        profile,
        liveDescriptor,
        coords: pendingCoords,
        method: 'face',
        existingLog: already,
      })
      if (result.error) {
        notify.error(result.error.message)
        return
      }
      const { error } = await markDailyAttendance(result.payload, user.id)
      if (error) notify.error(error.message)
      else await refreshAfterMark(session)
    } catch (err) {
      notify.error(err.message || 'Could not mark attendance')
    } finally {
      setMarking(false)
    }
  }

  const startPhoneHandoff = async (session) => {
    const { data, error } = await createAttendanceHandoff(session.id, session.class_id, user.id)
    if (error) {
      notify.error(error.message)
      return
    }
    setHandoffTokenId(data.id)
    setMarkMode('phone')
  }

  const openMarkModal = async (session) => {
    setPendingCoords(null)
    setHandoffTokenId(null)
    setMarkMode('camera')
    setCheckingCamera(true)
    const cam = await hasCamera()
    setCameraAvailable(cam)
    setCheckingCamera(false)

    if (session.require_location) {
      setLocLoading(true)
      try {
        const coords = await getCurrentCoords()
        setPendingCoords(coords)
      } catch (err) {
        if (cam) {
          notify.error(err.message || 'Could not get your location')
          return
        }
        // PC without camera: GPS will be captured on phone
      } finally {
        setLocLoading(false)
      }
    }

    setMarkModal(session)

    if (!cam) {
      await startPhoneHandoff(session)
    }
  }

  const onHandoffCompleted = useCallback(async () => {
    if (!markModal) return
    notify.success('Attendance marked from your phone!')
    await refreshAfterMark(markModal)
  }, [markModal, user?.id])

  const openFaceModal = async () => {
    setFaceRegMode('camera')
    setFaceHandoffTokenId(null)
    setCheckingCamera(true)
    const cam = await hasCamera()
    setCameraAvailable(cam)
    setCheckingCamera(false)
    setFaceModal(true)
    if (!cam) {
      const { data, error } = await createFaceRegistrationHandoff(user.id)
      if (error) notify.error(error.message)
      else {
        setFaceHandoffTokenId(data.id)
        setFaceRegMode('phone')
      }
    }
  }

  const onFaceHandoffCompleted = useCallback(async () => {
    await fetchProfile(user.id)
    setFaceModal(false)
    setFaceHandoffTokenId(null)
    setFaceRegMode('camera')
    setSuccessModal({ title: 'Face Registered', message: 'Your attendance face was saved from your phone. You can now mark attendance.' })
  }, [user?.id, fetchProfile])

  const hasFace = !!profile?.face_descriptor

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Mark Attendance</h1>
        <p className="page-subtitle">Face + GPS verification — use your phone via QR if this PC has no camera</p>
      </div>

      {!hasFace && (
        <div className="glass-card border-amber-200 bg-amber-50/50 p-5 dark:border-amber-900 dark:bg-amber-950/20">
          <div className="flex items-start gap-3">
            <HiOutlineCamera className="mt-0.5 h-6 w-6 text-amber-600" />
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900 dark:text-white">Register your face</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Use a phone or laptop with a camera once. After that you can mark attendance via QR on a PC without a camera.</p>
              <button type="button" onClick={openFaceModal} disabled={checkingCamera} className="btn-primary mt-3">
                {checkingCamera ? 'Checking device…' : 'Register Face'}
              </button>
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
                        type="button"
                        onClick={() => openMarkModal(session)}
                        disabled={!check.ok || locLoading || checkingCamera}
                        className="btn-primary py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {locLoading || checkingCamera ? 'Preparing…' : 'Mark Present'}
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
                  {log.method === 'mobile' ? ' · 📱 phone' : ''}
                  {log.face_verified ? ' · ✓ face' : ''}
                  {log.location_verified ? ' · ✓ GPS' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        isOpen={faceModal}
        onClose={() => { setFaceModal(false); setFaceHandoffTokenId(null); setFaceRegMode('camera') }}
        title="Register Your Face"
        size="lg"
      >
        {!cameraAvailable && faceRegMode === 'phone' && faceHandoffTokenId ? (
          <FaceRegisterQRHandoff
            tokenId={faceHandoffTokenId}
            onCompleted={onFaceHandoffCompleted}
            onExpired={() => notify.warning('QR expired — open Register Face again')}
          />
        ) : (
          <>
            <FaceCapture mode="register" label="Save Face Profile" onCapture={handleRegisterFace} />
            <button
              type="button"
              onClick={async () => {
                const { data, error } = await createFaceRegistrationHandoff(user.id)
                if (error) notify.error(error.message)
                else {
                  setFaceHandoffTokenId(data.id)
                  setFaceRegMode('phone')
                }
              }}
              className="btn-secondary mt-4 w-full text-sm"
            >
              <HiOutlineDeviceMobile className="h-5 w-5" /> Register using phone (scan QR)
            </button>
          </>
        )}
        {cameraAvailable && faceRegMode === 'phone' && faceHandoffTokenId && (
          <>
            <FaceRegisterQRHandoff
              tokenId={faceHandoffTokenId}
              onCompleted={onFaceHandoffCompleted}
              onExpired={() => notify.warning('QR expired — generate a new one')}
            />
            <button
              type="button"
              onClick={() => { setFaceRegMode('camera'); setFaceHandoffTokenId(null) }}
              className="btn-secondary mt-4 w-full text-sm"
            >
              <HiOutlineCamera className="h-5 w-5" /> Use this device camera
            </button>
          </>
        )}
      </Modal>

      <Modal
        isOpen={!!markModal}
        onClose={() => { if (!marking) { setMarkModal(null); setPendingCoords(null); setHandoffTokenId(null); setMarkMode('camera') } }}
        title={`Verify Attendance — ${markModal?.class?.name || ''}`}
        size="lg"
      >
        {markModal && !canMarkAttendanceSession(markModal, markModal.class, hasFace).ok ? (
          <p className="text-sm text-amber-600">{canMarkAttendanceSession(markModal, markModal.class, hasFace).reason}</p>
        ) : markModal?.require_face && (
          <>
            {!cameraAvailable && (
              <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200">
                <HiOutlineDeviceMobile className="mb-1 inline h-5 w-5" /> No camera detected on this device. Scan the QR code with your phone to complete attendance.
              </div>
            )}

            {markMode === 'phone' && handoffTokenId ? (
              <AttendanceQRHandoff
                tokenId={handoffTokenId}
                className={markModal.class?.name}
                onCompleted={onHandoffCompleted}
                onExpired={() => notify.warning('QR expired — generate a new one')}
              />
            ) : (
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
                <button
                  type="button"
                  onClick={() => startPhoneHandoff(markModal)}
                  className="btn-secondary mt-4 w-full text-sm"
                >
                  <HiOutlineDeviceMobile className="h-5 w-5" /> Use phone instead (scan QR)
                </button>
              </>
            )}

            {cameraAvailable && markMode === 'phone' && (
              <button
                type="button"
                onClick={() => { setMarkMode('camera'); setHandoffTokenId(null) }}
                className="btn-secondary mt-4 w-full text-sm"
              >
                <HiOutlineCamera className="h-5 w-5" /> Use this device camera
              </button>
            )}
          </>
        )}
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

import { useEffect, useState } from 'react'
import { HiOutlineDownload, HiOutlineLocationMarker, HiOutlinePlay, HiOutlineStop } from 'react-icons/hi'
import { useAuthStore } from '../../stores'
import { useInstitutionStore } from '../../stores/institution'
import { supabase } from '../../lib/supabase'
import { calcAttendancePercent, getAttendanceColor } from '../../utils/helpers'
import { exportToCSV } from '../../utils/helpers'
import { getCurrentCoords } from '../../lib/geo'
import { notify } from '../../lib/notify.jsx'

const colorMap = {
  green: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30',
  yellow: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30',
  red: 'text-red-600 bg-red-50 dark:bg-red-950/30',
}

export default function TeacherAttendancePage() {
  const user = useAuthStore((s) => s.user)
  const {
    classes, fetchTeacherClasses, classAttendance, fetchClassAttendance,
    openAttendanceSession, closeAttendanceSession, fetchSessionLogs,
    fetchClassAttendanceLogs, teacherMarkAttendance, updateClassCampus,
    upsertClassAttendance, attendanceLogs,
  } = useInstitutionStore()

  const [selectedClass, setSelectedClass] = useState('')
  const [students, setStudents] = useState([])
  const [todaySession, setTodaySession] = useState(null)
  const [exportFrom, setExportFrom] = useState('')
  const [exportTo, setExportTo] = useState(new Date().toISOString().split('T')[0])
  const [campusLat, setCampusLat] = useState('')
  const [campusLng, setCampusLng] = useState('')
  const [campusRadius, setCampusRadius] = useState('150')

  useEffect(() => {
    if (user?.id) fetchTeacherClasses(user.id)
  }, [user?.id])

  useEffect(() => {
    if (selectedClass) loadClassData()
  }, [selectedClass])

  const loadClassData = async () => {
    await fetchClassAttendance(selectedClass)
    const today = new Date().toISOString().split('T')[0]
    const { data: session } = await supabase
      .from('attendance_sessions')
      .select('*')
      .eq('class_id', selectedClass)
      .eq('session_date', today)
      .maybeSingle()
    setTodaySession(session)

    const cls = classes.find((c) => c.id === selectedClass)
    if (cls) {
      setCampusLat(cls.campus_lat ?? '')
      setCampusLng(cls.campus_lng ?? '')
      setCampusRadius(String(cls.campus_radius_m ?? 150))
    }

    const { data: enrollments } = await supabase.from('class_enrollments').select('student_id').eq('class_id', selectedClass)
    const ids = (enrollments || []).map((e) => e.student_id)
    const { data: profiles } = await supabase.from('profiles').select('id, name, roll_number').in('id', ids)
    setStudents((profiles || []).map((p) => ({ student_id: p.id, student: p })))

    if (session) await fetchSessionLogs(session.id)
  }

  const handleSaveCampus = async () => {
    const { error } = await updateClassCampus(selectedClass, {
      campus_lat: campusLat ? Number(campusLat) : null,
      campus_lng: campusLng ? Number(campusLng) : null,
      campus_radius_m: Number(campusRadius) || 150,
    })
    if (error) notify.error(error.message)
    else notify.success('Campus location saved')
  }

  const handleUseMyLocation = async () => {
    try {
      const { latitude, longitude } = await getCurrentCoords()
      setCampusLat(String(latitude))
      setCampusLng(String(longitude))
      notify.success('Location captured')
    } catch (err) {
      notify.error(err.message)
    }
  }

  const handleOpenSession = async () => {
    const { data, error } = await openAttendanceSession(selectedClass, user.id, {
      campus_lat: campusLat ? Number(campusLat) : null,
      campus_lng: campusLng ? Number(campusLng) : null,
      campus_radius_m: Number(campusRadius) || 150,
      require_face: true,
      require_location: !!(campusLat && campusLng),
    })
    if (error) notify.error(error.message)
    else {
      setTodaySession(data)
      await fetchSessionLogs(data.id)
    }
  }

  const handleCloseSession = async () => {
    if (!todaySession) return
    const { error } = await closeAttendanceSession(todaySession.id)
    if (error) notify.error(error.message)
    else await loadClassData()
  }

  const getLog = (studentId) => attendanceLogs.find((l) => l.student_id === studentId)
  const getRecord = (studentId) => classAttendance.find((a) => a.student_id === studentId)

  const handleManualMark = async (studentId, status) => {
    if (!todaySession) {
      notify.error('Open today\'s session first')
      return
    }
    const { error } = await teacherMarkAttendance({
      session_id: todaySession.id,
      class_id: selectedClass,
      student_id: studentId,
      status,
      face_verified: false,
      location_verified: false,
    }, user.id)
    if (error) notify.error(error.message)
    else await fetchSessionLogs(todaySession.id)
  }

  const handleExport = async () => {
    if (!selectedClass) return
    const logs = await fetchClassAttendanceLogs(selectedClass, exportFrom || null, exportTo || null)
    if (!logs.length) {
      notify.error('No records to export')
      return
    }
    const rows = logs.map((l) => ({
      date: l.session?.session_date || l.marked_at?.split('T')[0],
      class: classes.find((c) => c.id === selectedClass)?.name,
      roll_number: l.student?.roll_number || '',
      student_name: l.student?.name || '',
      email: l.student?.email || '',
      status: l.status,
      method: l.method,
      face_verified: l.face_verified ? 'yes' : 'no',
      location_verified: l.location_verified ? 'yes' : 'no',
      latitude: l.latitude ?? '',
      longitude: l.longitude ?? '',
      marked_at: l.marked_at,
    }))
    const code = classes.find((c) => c.id === selectedClass)?.code || 'class'
    exportToCSV(rows, `${code}-attendance-${exportTo}.csv`)
    notify.success('CSV downloaded')
  }

  const updateAggregate = async (studentId, field, value) => {
    const existing = getRecord(studentId) || { total_classes: 0, attended_classes: 0 }
    const payload = {
      class_id: selectedClass,
      student_id: studentId,
      total_classes: field === 'total_classes' ? Number(value) : existing.total_classes,
      attended_classes: field === 'attended_classes' ? Number(value) : existing.attended_classes,
    }
    const { error } = await upsertClassAttendance(payload, user.id)
    if (error) notify.error(error.message)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Class Attendance</h1>
        <p className="page-subtitle">Open daily sessions, verify face/location, export reports</p>
      </div>

      <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="input-field max-w-md">
        <option value="">Select a class...</option>
        {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      {selectedClass && (
        <>
          <div className="glass-card p-5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2"><HiOutlineLocationMarker /> Campus Location (Geofence)</h2>
            <p className="text-sm text-slate-500">Students must be within this radius to mark attendance via the app.</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div><label className="label-text">Latitude</label><input value={campusLat} onChange={(e) => setCampusLat(e.target.value)} className="input-field" placeholder="22.5726" /></div>
              <div><label className="label-text">Longitude</label><input value={campusLng} onChange={(e) => setCampusLng(e.target.value)} className="input-field" placeholder="88.3639" /></div>
              <div><label className="label-text">Radius (m)</label><input value={campusRadius} onChange={(e) => setCampusRadius(e.target.value)} className="input-field" /></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleUseMyLocation} className="btn-secondary">Use My GPS</button>
              <button onClick={handleSaveCampus} className="btn-secondary">Save Location</button>
            </div>
          </div>

          <div className="glass-card p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-semibold">Today&apos;s Session</p>
              <p className="text-sm text-slate-500">
                {todaySession
                  ? todaySession.is_open ? 'Open — students can mark attendance' : 'Closed'
                  : 'Not opened yet'}
              </p>
            </div>
            <div className="flex gap-2">
              {!todaySession?.is_open && (
                <button onClick={handleOpenSession} className="btn-primary"><HiOutlinePlay /> Open Session</button>
              )}
              {todaySession?.is_open && (
                <button onClick={handleCloseSession} className="btn-secondary text-red-500"><HiOutlineStop /> Close Session</button>
              )}
            </div>
          </div>

          <div className="glass-card p-5">
            <h2 className="mb-3 font-semibold flex items-center gap-2"><HiOutlineDownload /> Export CSV</h2>
            <div className="flex flex-wrap gap-3 items-end">
              <div><label className="label-text">From</label><input type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} className="input-field" /></div>
              <div><label className="label-text">To</label><input type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} className="input-field" /></div>
              <button onClick={handleExport} className="btn-primary">Download CSV</button>
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-left text-xs uppercase text-slate-500 dark:border-slate-800">
                  <th className="px-5 py-3">Student</th>
                  <th className="px-5 py-3">Today</th>
                  <th className="px-5 py-3">Total</th>
                  <th className="px-5 py-3">Attended</th>
                  <th className="px-5 py-3">%</th>
                  <th className="px-5 py-3">Manual</th>
                </tr>
              </thead>
              <tbody>
                {students.map(({ student_id, student }) => {
                  const log = getLog(student_id)
                  const rec = getRecord(student_id) || { total_classes: 0, attended_classes: 0 }
                  const pct = calcAttendancePercent(rec.attended_classes, rec.total_classes)
                  const color = getAttendanceColor(pct)
                  return (
                    <tr key={student_id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="px-5 py-3 font-medium">{student?.name}<br /><span className="text-xs text-slate-400">{student?.roll_number}</span></td>
                      <td className="px-5 py-3">
                        {log ? (
                          <span className="text-emerald-600 text-xs font-medium">{log.status} ({log.method})</span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <input type="number" min="0" defaultValue={rec.total_classes} onBlur={(e) => updateAggregate(student_id, 'total_classes', e.target.value)} className="input-field w-20 py-1" />
                      </td>
                      <td className="px-5 py-3">
                        <input type="number" min="0" defaultValue={rec.attended_classes} onBlur={(e) => updateAggregate(student_id, 'attended_classes', e.target.value)} className="input-field w-20 py-1" />
                      </td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${colorMap[color]}`}>{pct}%</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => handleManualMark(student_id, 'present')} className="text-xs text-emerald-600 hover:underline">Present</button>
                          <button onClick={() => handleManualMark(student_id, 'absent')} className="text-xs text-red-500 hover:underline">Absent</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

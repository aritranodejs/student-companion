import { useState, useEffect } from 'react'
import { HiOutlineDownload } from 'react-icons/hi'
import { useInstitutionStore } from '../../stores/institution'
import { exportToCSV } from '../../utils/helpers'
import { notify } from '../../lib/notify.jsx'

export default function AdminAttendancePage() {
  const { classes, departments, fetchAdminData, fetchClassAttendanceLogs } = useInstitutionStore()
  const [selectedClass, setSelectedClass] = useState('')
  const [exportFrom, setExportFrom] = useState('')
  const [exportTo, setExportTo] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => { fetchAdminData() }, [fetchAdminData])

  const handleExport = async () => {
    if (!selectedClass) {
      notify.error('Select a class')
      return
    }
    const logs = await fetchClassAttendanceLogs(selectedClass, exportFrom || null, exportTo || null)
    if (!logs.length) {
      notify.error('No records in this date range')
      return
    }
    const cls = classes.find((c) => c.id === selectedClass)
    const rows = logs.map((l) => ({
      date: l.session?.session_date || l.marked_at?.split('T')[0],
      department: cls?.course?.department?.name || '',
      course: cls?.course?.code || '',
      class_name: cls?.name || '',
      class_code: cls?.code || '',
      roll_number: l.student?.roll_number || '',
      student_name: l.student?.name || '',
      email: l.student?.email || '',
      status: l.status,
      method: l.method,
      face_verified: l.face_verified ? 'yes' : 'no',
      location_verified: l.location_verified ? 'yes' : 'no',
      latitude: l.latitude ?? '',
      longitude: l.longitude ?? '',
      face_match_score: l.face_match_score ?? '',
      marked_at: l.marked_at,
    }))
    exportToCSV(rows, `attendance-${cls?.code || 'export'}-${exportTo}.csv`)
    notify.success('CSV downloaded')
  }

  const handleExportAll = async () => {
    const allRows = []
    for (const cls of classes) {
      const logs = await fetchClassAttendanceLogs(cls.id, exportFrom || null, exportTo || null)
      logs.forEach((l) => {
        allRows.push({
          date: l.session?.session_date || l.marked_at?.split('T')[0],
          department: cls.course?.department?.name || '',
          course: cls.course?.code || '',
          class_name: cls.name,
          class_code: cls.code,
          roll_number: l.student?.roll_number || '',
          student_name: l.student?.name || '',
          email: l.student?.email || '',
          status: l.status,
          method: l.method,
          face_verified: l.face_verified ? 'yes' : 'no',
          location_verified: l.location_verified ? 'yes' : 'no',
          marked_at: l.marked_at,
        })
      })
    }
    if (!allRows.length) {
      notify.error('No records found')
      return
    }
    exportToCSV(allRows, `all-attendance-${exportTo}.csv`)
    notify.success('Full report downloaded')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Attendance Reports</h1>
        <p className="page-subtitle">Download daily attendance logs as CSV for any class</p>
      </div>

      <div className="glass-card p-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label-text">Class</label>
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="input-field">
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.course?.department?.code} → {c.course?.code} — {c.name}
                </option>
              ))}
            </select>
          </div>
          <div><label className="label-text">From</label><input type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} className="input-field" /></div>
          <div><label className="label-text">To</label><input type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} className="input-field" /></div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleExport} disabled={!selectedClass} className="btn-primary disabled:opacity-50">
            <HiOutlineDownload className="h-5 w-5" /> Export Class CSV
          </button>
          <button onClick={handleExportAll} className="btn-secondary">
            <HiOutlineDownload className="h-5 w-5" /> Export All Classes
          </button>
        </div>
      </div>

      <div className="glass-card p-6">
        <h2 className="mb-2 font-semibold">Institution Overview</h2>
        <p className="text-sm text-slate-500">{departments.length} departments · {classes.length} classes</p>
        <p className="mt-2 text-xs text-slate-400">
          CSV includes student name, roll number, status, face/location verification, GPS coordinates, and timestamp.
        </p>
      </div>
    </div>
  )
}

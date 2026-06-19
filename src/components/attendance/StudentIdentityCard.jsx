import { HiOutlineCamera, HiOutlineUser } from 'react-icons/hi'
import { format } from 'date-fns'

function Avatar({ url, name, size = 'md' }) {
  const sizes = { sm: 'h-10 w-10 text-sm', md: 'h-16 w-16 text-xl', lg: 'h-24 w-24 text-3xl' }
  if (url) {
    return <img src={url} alt={name} className={`${sizes[size]} rounded-full object-cover ring-2 ring-indigo-100 dark:ring-indigo-900`} />
  }
  return (
    <div className={`${sizes[size]} flex items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 font-bold text-white ring-2 ring-indigo-100 dark:ring-indigo-900`}>
      {name?.charAt(0)?.toUpperCase() || '?'}
    </div>
  )
}

export default function StudentIdentityCard({ student, attendanceLog, className = '' }) {
  const hasFace = !!student?.face_descriptor || !!student?.face_image_url

  return (
    <div className={`rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/40 ${className}`}>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="text-center">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Profile Photo</p>
          <Avatar url={student?.avatar_url} name={student?.name} size="lg" />
        </div>
        <div className="hidden h-24 w-px bg-slate-200 dark:bg-slate-700 sm:block" />
        <div className="text-center">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Attendance Face</p>
          {student?.face_image_url ? (
            <img
              src={student.face_image_url}
              alt="Registered face"
              className="h-24 w-24 rounded-2xl object-cover ring-2 ring-emerald-200 dark:ring-emerald-900"
            />
          ) : (
            <div className="flex h-24 w-24 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900">
              <HiOutlineCamera className="h-8 w-8 text-slate-400" />
              <span className="mt-1 text-[10px] text-slate-400">Not registered</span>
            </div>
          )}
        </div>
        <div className="flex-1 text-center sm:text-left">
          <div className="flex items-center justify-center gap-2 sm:justify-start">
            <HiOutlineUser className="h-4 w-4 text-indigo-500" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{student?.name}</h3>
          </div>
          <p className="text-sm text-slate-500">{student?.email}</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Roll: {student?.roll_number || '—'}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${hasFace ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'}`}>
              {hasFace ? 'Face registered' : 'Face not registered'}
            </span>
            {student?.face_registered_at && (
              <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                Since {format(new Date(student.face_registered_at), 'MMM d, yyyy')}
              </span>
            )}
          </div>
          {attendanceLog && (
            <div className="mt-3 rounded-xl bg-white p-3 text-left text-xs dark:bg-slate-900/60">
              <p className="font-semibold text-slate-700 dark:text-slate-200">Today&apos;s mark</p>
              <p className="mt-1 capitalize text-slate-600 dark:text-slate-400">
                {attendanceLog.status} · {attendanceLog.method}
                {attendanceLog.face_verified ? ' · ✓ face' : ''}
                {attendanceLog.location_verified ? ' · ✓ GPS' : ''}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export { Avatar }

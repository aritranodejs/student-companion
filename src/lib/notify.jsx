import toast from 'react-hot-toast'
import {
  HiOutlineCheckCircle,
  HiOutlineExclamation,
  HiOutlineInformationCircle,
  HiOutlineDocumentText,
  HiOutlineCalendar,
  HiOutlineClipboardCheck,
} from 'react-icons/hi'

const STYLES = {
  success: {
    icon: HiOutlineCheckCircle,
    className: '!bg-emerald-50 !text-emerald-900 !border !border-emerald-200 dark:!bg-emerald-950/80 dark:!text-emerald-100 dark:!border-emerald-800',
    iconColor: 'text-emerald-500',
  },
  error: {
    icon: HiOutlineExclamation,
    className: '!bg-red-50 !text-red-900 !border !border-red-200 dark:!bg-red-950/80 dark:!text-red-100 dark:!border-red-800',
    iconColor: 'text-red-500',
  },
  warning: {
    icon: HiOutlineExclamation,
    className: '!bg-amber-50 !text-amber-900 !border !border-amber-200 dark:!bg-amber-950/80 dark:!text-amber-100 dark:!border-amber-800',
    iconColor: 'text-amber-500',
  },
  info: {
    icon: HiOutlineInformationCircle,
    className: '!bg-indigo-50 !text-indigo-900 !border !border-indigo-200 dark:!bg-indigo-950/80 dark:!text-indigo-100 dark:!border-indigo-800',
    iconColor: 'text-indigo-500',
  },
  assignment: {
    icon: HiOutlineDocumentText,
    className: '!bg-purple-50 !text-purple-900 !border !border-purple-200 dark:!bg-purple-950/80 dark:!text-purple-100 dark:!border-purple-800',
    iconColor: 'text-purple-500',
  },
  exam: {
    icon: HiOutlineCalendar,
    className: '!bg-rose-50 !text-rose-900 !border !border-rose-200 dark:!bg-rose-950/80 dark:!text-rose-100 dark:!border-rose-800',
    iconColor: 'text-rose-500',
  },
  attendance: {
    icon: HiOutlineClipboardCheck,
    className: '!bg-teal-50 !text-teal-900 !border !border-teal-200 dark:!bg-teal-950/80 dark:!text-teal-100 dark:!border-teal-800',
    iconColor: 'text-teal-500',
  },
}

function show(type, message, title) {
  const config = STYLES[type] || STYLES.info
  const Icon = config.icon
  const text = title ? `${title}: ${message}` : message

  return toast.custom(
    (t) => (
      <div
        className={`${t.visible ? 'animate-enter' : 'animate-leave'} pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl p-4 shadow-xl ${config.className}`}
        onClick={() => toast.dismiss(t.id)}
      >
        <Icon className={`mt-0.5 h-6 w-6 shrink-0 ${config.iconColor}`} />
        <div className="flex-1">
          {title && <p className="text-sm font-semibold">{title}</p>}
          <p className={`text-sm ${title ? 'mt-0.5 opacity-90' : 'font-medium'}`}>{message}</p>
        </div>
      </div>
    ),
    { duration: 4000, position: 'top-right' }
  )
}

export const notify = {
  success: (msg, title) => show('success', msg, title),
  error: (msg, title) => show('error', msg, title),
  warning: (msg, title) => show('warning', msg, title),
  info: (msg, title) => show('info', msg, title),
  assignment: (msg, title = 'New Assignment') => show('assignment', msg, title),
  exam: (msg, title = 'Exam Alert') => show('exam', msg, title),
  attendance: (msg, title = 'Attendance') => show('attendance', msg, title),
}

export const NOTIFICATION_ICONS = {
  info: HiOutlineInformationCircle,
  success: HiOutlineCheckCircle,
  warning: HiOutlineExclamation,
  assignment: HiOutlineDocumentText,
  exam: HiOutlineCalendar,
  attendance: HiOutlineClipboardCheck,
}

export const NOTIFICATION_COLORS = {
  info: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400',
  success: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
  warning: 'bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400',
  assignment: 'bg-purple-100 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400',
  exam: 'bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400',
  attendance: 'bg-teal-100 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400',
}

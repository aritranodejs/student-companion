import { motion } from 'framer-motion'
import {
  HiOutlineCheckCircle,
  HiOutlineExclamation,
  HiOutlineInformationCircle,
} from 'react-icons/hi'
import Modal from './Modal'

const VARIANTS = {
  success: {
    icon: HiOutlineCheckCircle,
    iconBg: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
    btn: 'btn-primary',
  },
  error: {
    icon: HiOutlineExclamation,
    iconBg: 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400',
    btn: 'btn-danger',
  },
  warning: {
    icon: HiOutlineExclamation,
    iconBg: 'bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400',
    btn: 'btn-primary',
  },
  info: {
    icon: HiOutlineInformationCircle,
    iconBg: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400',
    btn: 'btn-primary',
  },
}

export default function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  variant = 'success',
  confirmLabel = 'Got it',
  children,
}) {
  const config = VARIANTS[variant] || VARIANTS.info
  const Icon = config.icon

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="sm">
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${config.iconBg}`}
        >
          <Icon className="h-8 w-8" />
        </motion.div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
        {message && <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{message}</p>}
        {children}
        <button type="button" onClick={onClose} className={`${config.btn} mt-6 w-full`}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'warning',
  loading = false,
}) {
  const config = VARIANTS[variant] || VARIANTS.warning
  const Icon = config.icon

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="sm">
      <div className="text-center">
        <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${config.iconBg}`}>
          <Icon className="h-7 w-7" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
        {message && <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{message}</p>}
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onClose} disabled={loading} className="btn-secondary flex-1">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={loading} className={`${config.btn} flex-1`}>
            {loading ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}

import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { HiOutlineDeviceMobile, HiOutlineRefresh } from 'react-icons/hi'
import { supabase } from '../../lib/supabase'

const HANDOFF_TTL_MS = 10 * 60 * 1000

export default function AttendanceQRHandoff({ tokenId, className, onCompleted, onExpired }) {
  const [status, setStatus] = useState('pending')
  const [expiresAt, setExpiresAt] = useState(null)

  const handoffUrl = `${window.location.origin}/attendance/mobile/${tokenId}`

  useEffect(() => {
    if (!tokenId) return undefined

    const poll = async () => {
      const { data } = await supabase
        .from('attendance_handoff_tokens')
        .select('status, expires_at')
        .eq('id', tokenId)
        .single()

      if (!data) return

      setExpiresAt(data.expires_at)

      if (data.status === 'completed') {
        setStatus('completed')
        onCompleted?.()
        return
      }

      if (data.status === 'cancelled' || data.status === 'expired') {
        setStatus('expired')
        onExpired?.()
        return
      }

      if (new Date(data.expires_at) < new Date()) {
        await supabase
          .from('attendance_handoff_tokens')
          .update({ status: 'expired' })
          .eq('id', tokenId)
          .eq('status', 'pending')
        setStatus('expired')
        onExpired?.()
      }
    }

    poll()
    const interval = setInterval(poll, 2500)
    return () => clearInterval(interval)
  }, [tokenId, onCompleted, onExpired])

  const minutesLeft = expiresAt
    ? Math.max(0, Math.ceil((new Date(expiresAt) - Date.now()) / 60000))
    : Math.ceil(HANDOFF_TTL_MS / 60000)

  if (status === 'completed') {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-900 dark:bg-emerald-950/30">
        <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">Attendance marked from phone!</p>
        <p className="mt-1 text-sm text-emerald-600 dark:text-emerald-400">You can close this window.</p>
      </div>
    )
  }

  if (status === 'expired') {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-900 dark:bg-amber-950/30">
        <p className="font-semibold text-amber-800 dark:text-amber-200">QR code expired</p>
        <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">Generate a new code to try again.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
        <HiOutlineDeviceMobile className="h-6 w-6" />
      </div>
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Scan with your phone</h3>
        <p className="mt-1 text-sm text-slate-500">
          No camera on this PC? Scan the QR code with your phone camera, log in if asked, then verify face + GPS on your phone.
        </p>
        {className && <p className="mt-2 text-sm font-medium text-indigo-600">{className}</p>}
      </div>

      <div className="mx-auto inline-block rounded-2xl bg-white p-4 shadow-lg ring-1 ring-slate-200 dark:bg-white">
        <QRCodeSVG value={handoffUrl} size={200} level="M" includeMargin />
      </div>

      <p className="text-xs text-slate-400 break-all px-4">{handoffUrl}</p>

      <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
        <HiOutlineRefresh className="h-4 w-4 animate-spin" />
        Waiting for phone verification · expires in ~{minutesLeft} min
      </div>
    </div>
  )
}

export { HANDOFF_TTL_MS }

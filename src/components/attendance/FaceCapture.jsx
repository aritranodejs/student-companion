import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HiOutlineCheckCircle, HiOutlineShieldCheck } from 'react-icons/hi'
import {
  detectFaceLive,
  compareDescriptors,
  captureVideoFrame,
  drawFaceOverlay,
  MATCH_THRESHOLD,
} from '../../lib/faceRecognition'

const STATUS = {
  idle: 'Position your face inside the frame',
  detected: 'Face detected — hold still',
  aligned: 'Perfect! Tap capture or wait…',
  verifying: 'Verifying identity…',
  matched: 'Identity verified',
  noFace: 'No face detected — look at the camera',
}

export default function FaceCapture({
  onCapture,
  label = 'Capture Face',
  disabled = false,
  mode = 'register',
  referenceDescriptor = null,
  autoCapture = false,
}) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const matchStreakRef = useRef(0)
  const capturingRef = useRef(false)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState(STATUS.idle)
  const [confidence, setConfidence] = useState(0)
  const [aligned, setAligned] = useState(false)

  const startCamera = useCallback(async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 540 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setReady(true)
      }
    } catch (err) {
      setError(err.message || 'Camera access denied')
    }
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setReady(false)
  }, [])

  useEffect(() => {
    startCamera()
    return () => stopCamera()
  }, [startCamera, stopCamera])

  const finalizeCapture = useCallback(async (detection) => {
    if (!detection || busy || disabled || capturingRef.current) return
    capturingRef.current = true
    setBusy(true)
    setStatus(STATUS.verifying)
    setError('')
    try {
      const descriptor = Array.from(detection.descriptor)
      if (mode === 'verify' && referenceDescriptor) {
        const { match, confidence: conf } = await compareDescriptors(referenceDescriptor, descriptor)
        setConfidence(conf)
        if (!match) {
          setError('Face does not match your registered profile. Try again in better lighting.')
          setStatus(STATUS.noFace)
          matchStreakRef.current = 0
          return
        }
      }
      const snapshot = videoRef.current ? await captureVideoFrame(videoRef.current) : null
      setStatus(STATUS.matched)
      await onCapture(descriptor, snapshot)
    } catch (err) {
      setError(err.message || 'Face capture failed')
      setStatus(STATUS.noFace)
    } finally {
      setBusy(false)
      capturingRef.current = false
    }
  }, [busy, disabled, mode, onCapture, referenceDescriptor])

  useEffect(() => {
    if (!ready || busy || disabled) return undefined

    let cancelled = false
    const interval = setInterval(async () => {
      if (cancelled || !videoRef.current || !canvasRef.current) return
      const video = videoRef.current
      const canvas = canvasRef.current
      if (video.readyState < 2) return

      const w = video.videoWidth || 640
      const h = video.videoHeight || 480
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')

      try {
        const detection = await detectFaceLive(video)
        const overlay = drawFaceOverlay(ctx, detection, w, h)

        if (!detection) {
          setAligned(false)
          setStatus(STATUS.noFace)
          setConfidence(0)
          matchStreakRef.current = 0
          return
        }

        const isAligned = overlay?.aligned
        setAligned(!!isAligned)
        setStatus(isAligned ? STATUS.aligned : STATUS.detected)

        if (mode === 'verify' && referenceDescriptor) {
          const { match, confidence: conf } = await compareDescriptors(referenceDescriptor, Array.from(detection.descriptor))
          setConfidence(conf)
          if (match && isAligned) {
            matchStreakRef.current += 1
            if (autoCapture && matchStreakRef.current >= 3) {
              await finalizeCapture(detection)
            }
          } else {
            matchStreakRef.current = 0
          }
        } else if (isAligned) {
          matchStreakRef.current += 1
        } else {
          matchStreakRef.current = 0
        }
      } catch {
        /* skip frame */
      }
    }, 280)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [ready, busy, disabled, mode, referenceDescriptor, autoCapture, finalizeCapture])

  const handleCapture = async () => {
    if (!videoRef.current || busy) return
    setBusy(true)
    setError('')
    try {
      const detection = await detectFaceLive(videoRef.current)
      if (!detection) {
        setError('No face detected. Look at the camera in good lighting.')
        setStatus(STATUS.noFace)
        return
      }
      await finalizeCapture(detection)
    } catch (err) {
      setError(err.message || 'Face capture failed')
    } finally {
      setBusy(false)
    }
  }

  const ringColor = mode === 'verify'
    ? confidence >= 70 ? 'stroke-emerald-400' : confidence >= 40 ? 'stroke-amber-400' : 'stroke-indigo-400'
    : aligned ? 'stroke-emerald-400' : 'stroke-indigo-400'

  return (
    <div className="space-y-4">
      <div className="relative mx-auto aspect-[4/3] max-w-md overflow-hidden rounded-3xl bg-slate-950 shadow-2xl ring-1 ring-white/10">
        <video ref={videoRef} className="mirror h-full w-full object-cover" playsInline muted />
        <canvas ref={canvasRef} className="mirror pointer-events-none absolute inset-0 h-full w-full object-cover" />

        {/* Oval face guide */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className={`face-oval ${aligned ? 'face-oval--aligned' : ''}`} />
        </div>

        {/* Scan line */}
        <div className="face-scan-line pointer-events-none absolute inset-x-8 top-1/4 h-0.5 bg-gradient-to-r from-transparent via-emerald-400/80 to-transparent" />

        {/* Confidence ring (verify mode) */}
        {mode === 'verify' && (
          <div className="absolute right-3 top-3 flex flex-col items-center gap-1 rounded-2xl bg-black/50 px-3 py-2 backdrop-blur-md">
            <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
              <circle
                cx="28" cy="28" r="24" fill="none"
                className={ringColor}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${(confidence / 100) * 150.8} 150.8`}
              />
            </svg>
            <span className="text-xs font-bold text-white">{confidence}%</span>
            <span className="text-[10px] text-white/60">match</span>
          </div>
        )}

        {!ready && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/80">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
            <p className="text-sm text-white/70">Starting camera…</p>
          </div>
        )}

        <AnimatePresence>
          {status === STATUS.matched && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex items-center justify-center bg-emerald-500/20 backdrop-blur-sm"
            >
              <HiOutlineCheckCircle className="h-16 w-16 text-emerald-400 drop-shadow-lg" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-3 dark:bg-slate-800/80">
        <HiOutlineShieldCheck className={`h-5 w-5 shrink-0 ${aligned ? 'text-emerald-500' : 'text-indigo-500'}`} />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{busy ? STATUS.verifying : status}</p>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleCapture}
        disabled={!ready || busy || disabled}
        className="btn-primary w-full disabled:opacity-50"
      >
        {busy ? 'Processing…' : label}
      </button>

      {mode === 'verify' && autoCapture && (
        <p className="text-center text-xs text-slate-500">Auto-capture when face match is stable</p>
      )}

      <style>{`
        .mirror { transform: scaleX(-1); }
        .face-oval {
          width: 55%;
          height: 72%;
          border: 2px dashed rgba(129, 140, 248, 0.7);
          border-radius: 50%;
          box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.35);
          transition: border-color 0.3s, box-shadow 0.3s;
        }
        .face-oval--aligned {
          border-color: rgba(52, 211, 153, 0.9);
          border-style: solid;
          box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.25), 0 0 24px rgba(52, 211, 153, 0.3);
        }
        .face-scan-line {
          animation: face-scan 2.5s ease-in-out infinite;
        }
        @keyframes face-scan {
          0%, 100% { transform: translateY(0); opacity: 0.3; }
          50% { transform: translateY(120px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
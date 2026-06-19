import { useEffect, useRef, useState, useCallback } from 'react'
import { detectFaceDescriptor } from '../../lib/faceRecognition'

export default function FaceCapture({ onCapture, label = 'Capture Face', disabled = false }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const startCamera = useCallback(async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
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

  const handleCapture = async () => {
    if (!videoRef.current || busy) return
    setBusy(true)
    setError('')
    try {
      const descriptor = await detectFaceDescriptor(videoRef.current)
      if (!descriptor) {
        setError('No face detected. Look at the camera in good lighting.')
        return
      }
      onCapture(descriptor)
    } catch (err) {
      setError(err.message || 'Face capture failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl bg-slate-900 aspect-video">
        <video ref={videoRef} className="h-full w-full object-cover mirror" playsInline muted />
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
            Starting camera...
          </div>
        )}
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button type="button" onClick={handleCapture} disabled={!ready || busy || disabled} className="btn-primary w-full disabled:opacity-50">
        {busy ? 'Detecting face...' : label}
      </button>
      <style>{`.mirror { transform: scaleX(-1); }`}</style>
    </div>
  )
}

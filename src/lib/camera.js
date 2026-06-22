/** Detect whether a camera is available on this device */
export async function hasCamera() {
  if (!navigator.mediaDevices?.getUserMedia) return false
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false,
    })
    stream.getTracks().forEach((t) => t.stop())
    return true
  } catch (err) {
    if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') return false
    // Permission denied or other — camera may still exist
    if (navigator.mediaDevices.enumerateDevices) {
      const devices = await navigator.mediaDevices.enumerateDevices()
      return devices.some((d) => d.kind === 'videoinput')
    }
    return false
  }
}

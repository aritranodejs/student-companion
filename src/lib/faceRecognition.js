const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model'
export const MATCH_THRESHOLD = 0.55

let modelsLoaded = false
let faceapiModule = null

async function getFaceApi() {
  if (!faceapiModule) {
    faceapiModule = await import('@vladmandic/face-api')
  }
  return faceapiModule
}

export async function loadFaceModels() {
  if (modelsLoaded) return
  const faceapi = await getFaceApi()
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ])
  modelsLoaded = true
}

function detectorOptions() {
  return { inputSize: 416, scoreThreshold: 0.45 }
}

export async function detectFaceLive(videoOrCanvas) {
  const faceapi = await getFaceApi()
  await loadFaceModels()
  return faceapi
    .detectSingleFace(videoOrCanvas, new faceapi.TinyFaceDetectorOptions(detectorOptions()))
    .withFaceLandmarks()
    .withFaceDescriptor()
}

export async function detectFaceDescriptor(videoOrCanvas) {
  const detection = await detectFaceLive(videoOrCanvas)
  if (!detection) return null
  return Array.from(detection.descriptor)
}

export async function compareDescriptors(stored, live) {
  if (!stored?.length || !live?.length) return { match: false, score: 1, confidence: 0 }
  const faceapi = await getFaceApi()
  const a = new Float32Array(stored)
  const b = new Float32Array(live)
  const distance = faceapi.euclideanDistance(a, b)
  const confidence = Math.max(0, Math.min(100, Math.round((1 - distance / MATCH_THRESHOLD) * 100)))
  return { match: distance < MATCH_THRESHOLD, score: distance, confidence }
}

export function captureVideoFrame(video) {
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth || 640
  canvas.height = video.videoHeight || 480
  const ctx = canvas.getContext('2d')
  ctx.translate(canvas.width, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88))
}

export function drawFaceOverlay(ctx, detection, width, height) {
  ctx.clearRect(0, 0, width, height)
  if (!detection) return

  const box = detection.detection.box
  const cx = width / 2
  const cy = height / 2
  const faceCx = box.x + box.width / 2
  const faceCy = box.y + box.height / 2
  const dx = Math.abs(faceCx - cx) / width
  const dy = Math.abs(faceCy - cy) / height
  const sizeOk = box.width > width * 0.22 && box.width < width * 0.72
  const centered = dx < 0.12 && dy < 0.12
  const aligned = sizeOk && centered

  ctx.strokeStyle = aligned ? '#34d399' : '#818cf8'
  ctx.lineWidth = 2
  ctx.setLineDash([])
  ctx.strokeRect(box.x, box.y, box.width, box.height)

  if (detection.landmarks) {
    ctx.fillStyle = aligned ? 'rgba(52, 211, 153, 0.8)' : 'rgba(129, 140, 248, 0.8)'
    detection.landmarks.positions.forEach((pt) => {
      ctx.beginPath()
      ctx.arc(pt.x, pt.y, 1.5, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  return { aligned, sizeOk, centered }
}

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model'
const MATCH_THRESHOLD = 0.55

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

export async function detectFaceDescriptor(videoOrCanvas) {
  const faceapi = await getFaceApi()
  await loadFaceModels()
  const detection = await faceapi
    .detectSingleFace(videoOrCanvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor()

  if (!detection) return null
  return Array.from(detection.descriptor)
}

export async function compareDescriptors(stored, live) {
  if (!stored?.length || !live?.length) return { match: false, score: 1 }
  const faceapi = await getFaceApi()
  const a = new Float32Array(stored)
  const b = new Float32Array(live)
  const distance = faceapi.euclideanDistance(a, b)
  return { match: distance < MATCH_THRESHOLD, score: distance }
}

export { MATCH_THRESHOLD }

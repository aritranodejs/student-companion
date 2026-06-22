import { compareDescriptors } from './faceRecognition'
import { isWithinCampus } from './geo'
import { getCampusCoords, isCampusConfigured, canMarkAttendanceSession } from './institutionRules'

export async function buildAttendancePayload({
  session,
  profile,
  liveDescriptor,
  coords,
  method = 'face',
  existingLog,
}) {
  if (existingLog) {
    return { error: { message: 'You already marked attendance for this class today' } }
  }

  const sessionClass = session.class
  const precheck = canMarkAttendanceSession(session, sessionClass, !!profile?.face_descriptor)
  if (!precheck.ok) return { error: { message: precheck.reason } }

  let faceVerified = false
  let faceScore = null
  let locationVerified = false
  let latitude = null
  let longitude = null

  if (session.require_face) {
    if (!profile?.face_descriptor) {
      return { error: { message: 'Register your face first' } }
    }
    if (!liveDescriptor) {
      return { error: { message: 'Face verification required' } }
    }
    const { match, score } = await compareDescriptors(profile.face_descriptor, liveDescriptor)
    faceVerified = match
    faceScore = score
    if (!match) {
      return { error: { message: 'Face verification failed. Try again in better lighting.' } }
    }
  }

  if (session.require_location) {
    const { lat, lng, radius } = getCampusCoords(session, sessionClass)
    if (!isCampusConfigured(lat, lng)) {
      return { error: { message: 'Campus location is not set by your teacher. Attendance cannot be marked yet.' } }
    }
    if (!coords) {
      return { error: { message: 'GPS location is required. Enable location on your device.' } }
    }
    latitude = coords.latitude
    longitude = coords.longitude
    locationVerified = isWithinCampus(latitude, longitude, lat, lng, radius)
    if (!locationVerified) {
      return { error: { message: `You must be on campus (within ${radius}m) to mark attendance` } }
    }
  }

  let finalMethod = method
  if (method === 'face' || method === 'student_app') {
    if (faceVerified && locationVerified) finalMethod = 'face'
    else if (faceVerified) finalMethod = 'face'
    else if (locationVerified) finalMethod = 'location'
    else finalMethod = 'student_app'
  }

  return {
    payload: {
      session_id: session.id,
      class_id: session.class_id,
      status: 'present',
      method: finalMethod,
      latitude,
      longitude,
      face_match_score: faceScore,
      face_verified: faceVerified,
      location_verified: locationVerified,
    },
    faceVerified,
    locationVerified,
  }
}

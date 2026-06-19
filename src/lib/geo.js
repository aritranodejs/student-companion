/** Haversine distance in meters between two GPS coordinates */
export function haversineDistanceM(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function isWithinCampus(userLat, userLng, campusLat, campusLng, radiusM = 150) {
  if (userLat == null || userLng == null || campusLat == null || campusLng == null) return false
  return haversineDistanceM(userLat, userLng, campusLat, campusLng) <= radiusM
}

const GEO_ERROR_MESSAGES = {
  1: 'Location access is blocked. Click the lock icon in your browser address bar → Site settings → Allow Location, then try again.',
  2: 'Location is unavailable on this device. Check that system location services are enabled.',
  3: 'Location request timed out. Move closer to a window or retry in a few seconds.',
}

function formatGeoError(err) {
  if (!err) return new Error('Could not get your location')
  const code = err.code ?? err.PERMISSION_DENIED
  if (typeof code === 'number' && GEO_ERROR_MESSAGES[code]) {
    return new Error(GEO_ERROR_MESSAGES[code])
  }
  const raw = err.message || ''
  if (/denied|permission/i.test(raw)) {
    return new Error(GEO_ERROR_MESSAGES[1])
  }
  return new Error(raw || 'Could not get your location')
}

export async function checkGeolocationReady() {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return { ok: false, reason: 'Location requires a secure connection (HTTPS or localhost).' }
  }
  if (!navigator?.geolocation) {
    return { ok: false, reason: 'Geolocation is not supported on this device.' }
  }
  if (navigator.permissions?.query) {
    try {
      const status = await navigator.permissions.query({ name: 'geolocation' })
      if (status.state === 'denied') {
        return { ok: false, reason: GEO_ERROR_MESSAGES[1] }
      }
    } catch {
      /* Permissions API unsupported — continue */
    }
  }
  return { ok: true }
}

function getPositionOnce(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })
}

export async function getCurrentPosition(options = {}) {
  const ready = await checkGeolocationReady()
  if (!ready.ok) throw new Error(ready.reason)

  const attempts = [
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0, ...options },
    { enableHighAccuracy: false, timeout: 25000, maximumAge: 30000, ...options },
  ]

  let lastError = null
  for (const opts of attempts) {
    try {
      return await getPositionOnce(opts)
    } catch (err) {
      lastError = err
      if (err?.code === 1) break
    }
  }
  throw formatGeoError(lastError)
}

export async function getCurrentCoords() {
  const pos = await getCurrentPosition()
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
  }
}

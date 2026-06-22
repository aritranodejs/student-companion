import { supabase } from './supabase'

function rpcError(error, data) {
  if (error) return { ok: false, error: error.message }
  if (!data?.ok) return { ok: false, error: data?.error || 'Request failed' }
  return { ok: true, ...data }
}

export async function fetchFaceRegistrationHandoff(tokenId) {
  const { data, error } = await supabase.rpc('get_face_registration_handoff', {
    p_token_id: tokenId,
  })
  return rpcError(error, data)
}

export async function submitFaceRegistrationHandoff(tokenId, descriptor) {
  const { data, error } = await supabase.rpc('complete_face_registration_handoff', {
    p_token_id: tokenId,
    p_descriptor: descriptor,
  })
  return rpcError(error, data)
}

export async function fetchAttendanceHandoff(tokenId) {
  const { data, error } = await supabase.rpc('get_attendance_handoff', {
    p_token_id: tokenId,
  })
  return rpcError(error, data)
}

export async function submitAttendanceHandoff(tokenId, payload) {
  const { data, error } = await supabase.rpc('complete_attendance_handoff', {
    p_token_id: tokenId,
    p_latitude: payload.latitude ?? null,
    p_longitude: payload.longitude ?? null,
    p_face_verified: payload.face_verified ?? false,
    p_face_match_score: payload.face_match_score ?? null,
    p_method: payload.method ?? 'mobile',
  })
  return rpcError(error, data)
}

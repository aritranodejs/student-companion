import { useEffect } from 'react'
import { useAuthStore, useDataStore } from '../stores'
import { useInstitutionStore } from '../stores/institution'
import { syncOfflineQueue } from '../lib/offline'
import { supabase } from '../lib/supabase'

export default function useAppData() {
  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const fetchAll = useDataStore((s) => s.fetchAll)
  const fetchAdminData = useInstitutionStore((s) => s.fetchAdminData)
  const fetchTeacherClasses = useInstitutionStore((s) => s.fetchTeacherClasses)
  const fetchTeacherReferenceData = useInstitutionStore((s) => s.fetchTeacherReferenceData)

  useEffect(() => {
    if (user?.id) {
      fetchAll(user.id, profile?.role || 'student')
      if (profile?.role === 'admin') fetchAdminData()
      if (profile?.role === 'teacher') {
        fetchTeacherClasses(user.id)
        fetchTeacherReferenceData(user.id)
      }
      syncOfflineQueue(supabase, user.id)
    }
  }, [user?.id, profile?.role, fetchAll, fetchAdminData, fetchTeacherClasses, fetchTeacherReferenceData])

  useEffect(() => {
    const handleOnline = () => {
      if (user?.id) {
        syncOfflineQueue(supabase, user.id)
        fetchAll(user.id, profile?.role || 'student')
      }
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [user?.id, profile?.role, fetchAll])
}

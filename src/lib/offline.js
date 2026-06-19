const STORAGE_KEY = 'student-companion-offline-queue'

export function getOfflineQueue() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

export function addToOfflineQueue(action) {
  const queue = getOfflineQueue()
  queue.push({ ...action, timestamp: Date.now() })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
}

export function clearOfflineQueue() {
  localStorage.removeItem(STORAGE_KEY)
}

export async function syncOfflineQueue(supabase, userId) {
  const queue = getOfflineQueue()
  if (!queue.length || !userId) return

  for (const item of queue) {
    try {
      const { table, operation, data } = item
      if (operation === 'insert') {
        await supabase.from(table).insert({ ...data, user_id: userId })
      } else if (operation === 'update') {
        await supabase.from(table).update(data.values).eq('id', data.id)
      } else if (operation === 'delete') {
        await supabase.from(table).delete().eq('id', data.id)
      }
    } catch (err) {
      console.error('Offline sync failed:', err)
      return
    }
  }
  clearOfflineQueue()
}

export function isOnline() {
  return navigator.onLine
}

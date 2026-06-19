import { HiOutlineExclamation } from 'react-icons/hi'
import { isSupabaseConfigured } from '../../lib/supabase'

export default function SupabaseBanner() {
  if (isSupabaseConfigured()) return null

  return (
    <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
      <HiOutlineExclamation className="h-5 w-5 shrink-0" />
      <p>
        Supabase is not configured. Copy <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">.env.example</code> to{' '}
        <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">.env</code> and add your credentials.
      </p>
    </div>
  )
}

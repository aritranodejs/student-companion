import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { HiOutlineCamera } from 'react-icons/hi'
import { useAuthStore } from '../stores'
import { supabase } from '../lib/supabase'

export default function ProfilePage() {
  const { user, profile, updateProfile } = useAuthStore()
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { name: profile?.name || '' },
  })

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB')
      return
    }
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (uploadError) {
      toast.error(uploadError.message)
      setUploading(false)
      return
    }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    const { error } = await updateProfile({ avatar_url: publicUrl })
    setUploading(false)
    if (error) toast.error(error.message)
    else toast.success('Avatar updated!')
  }

  const onSubmit = async (data) => {
    const { error } = await updateProfile({ name: data.name })
    if (error) toast.error(error.message)
    else toast.success('Profile updated!')
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="page-title">Profile</h1>
        <p className="page-subtitle">Manage your account information</p>
      </div>

      <div className="glass-card p-8">
        <div className="mb-8 flex flex-col items-center">
          <div className="relative">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="h-24 w-24 rounded-full object-cover ring-4 ring-indigo-100 dark:ring-indigo-900" />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-3xl font-bold text-white ring-4 ring-indigo-100 dark:ring-indigo-900">
                {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500 text-white shadow-lg hover:bg-indigo-600"
            >
              <HiOutlineCamera className="h-4 w-4" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">{profile?.name}</h2>
          <p className="text-sm text-slate-500">{profile?.email || user?.email}</p>
          {profile?.created_at && (
            <p className="mt-1 text-xs text-slate-400">Joined {format(new Date(profile.created_at), 'MMMM yyyy')}</p>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label-text">Full Name</label>
            <input {...register('name', { required: 'Name is required' })} className="input-field" />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label-text">Email</label>
            <input value={profile?.email || user?.email || ''} disabled className="input-field opacity-60" />
          </div>
          <button type="submit" className="btn-primary w-full">Update Profile</button>
        </form>
      </div>
    </div>
  )
}

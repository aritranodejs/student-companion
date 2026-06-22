import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { useAuthStore } from '../stores'
import { getHomeForRole } from '../constants/roles'
import { notify } from '../lib/notify.jsx'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from?.pathname
  const signIn = useAuthStore((s) => s.signIn)
  const fetchProfile = useAuthStore((s) => s.fetchProfile)
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm()

  const onSubmit = async (data) => {
    setLoading(true)
    const { data: authData, error } = await signIn(data.email, data.password)
    if (error) {
      setLoading(false)
      notify.error(error.message, 'Login Failed')
      return
    }
    if (authData?.user) {
      await fetchProfile(authData.user.id)
      const profile = useAuthStore.getState().profile
      notify.success(`Welcome back, ${profile?.name?.split(' ')[0] || 'there'}!`)
      navigate(redirectTo || getHomeForRole(profile?.role || 'student'))
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md glass-card p-8 shadow-2xl"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-2xl font-bold text-white shadow-lg shadow-indigo-500/40">
            SC
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Welcome Back</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in as Admin, Teacher, or Student</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label-text">Email</label>
            <input type="email" {...register('email', { required: 'Email is required' })} className="input-field" placeholder="you@college.edu" />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
          </div>
          <div>
            <label className="label-text">Password</label>
            <input type="password" {...register('password', { required: 'Password is required' })} className="input-field" placeholder="••••••••" />
            {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
          </div>
          <div className="text-right">
            <Link to="/forgot-password" className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">Forgot password?</Link>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Don't have an account?{' '}
          <Link to="/signup" className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">Sign up as Student</Link>
        </p>
      </motion.div>
    </div>
  )
}

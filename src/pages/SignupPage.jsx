import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAuthStore } from '../stores'

export default function SignupPage() {
  const navigate = useNavigate()
  const signUp = useAuthStore((s) => s.signUp)
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, watch, formState: { errors } } = useForm()

  const onSubmit = async (data) => {
    setLoading(true)
    const { error } = await signUp(data.email, data.password, data.name)
    setLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Account created! Check your email to verify.')
      navigate('/login')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-700 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md glass-card p-8"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-2xl font-bold text-white">
            SC
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Create Account</h1>
          <p className="mt-1 text-sm text-slate-500">Start your academic journey</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label-text">Full Name</label>
            <input
              {...register('name', { required: 'Name is required' })}
              className="input-field"
              placeholder="John Doe"
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <div>
            <label className="label-text">Email</label>
            <input
              type="email"
              {...register('email', { required: 'Email is required' })}
              className="input-field"
              placeholder="you@college.edu"
            />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
          </div>

          <div>
            <label className="label-text">Password</label>
            <input
              type="password"
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 6, message: 'Minimum 6 characters' },
              })}
              className="input-field"
              placeholder="••••••••"
            />
            {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
          </div>

          <div>
            <label className="label-text">Confirm Password</label>
            <input
              type="password"
              {...register('confirmPassword', {
                required: 'Please confirm password',
                validate: (val) => val === watch('password') || 'Passwords do not match',
              })}
              className="input-field"
              placeholder="••••••••"
            />
            {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword.message}</p>}
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  )
}

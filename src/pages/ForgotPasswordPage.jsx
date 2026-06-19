import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAuthStore } from '../stores'

export default function ForgotPasswordPage() {
  const resetPassword = useAuthStore((s) => s.resetPassword)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm()

  const onSubmit = async (data) => {
    setLoading(true)
    const { error } = await resetPassword(data.email)
    setLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      setSent(true)
      toast.success('Reset link sent to your email!')
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reset Password</h1>
          <p className="mt-1 text-sm text-slate-500">
            {sent ? 'Check your email for the reset link' : 'Enter your email to receive a reset link'}
          </p>
        </div>

        {!sent && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/login" className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
            Back to login
          </Link>
        </p>
      </motion.div>
    </div>
  )
}

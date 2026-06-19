import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { HiOutlinePlus, HiOutlineTrash, HiOutlineCheck } from 'react-icons/hi'
import { useAuthStore, useDataStore } from '../stores'
import { BADGE_DEFINITIONS } from '../constants'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import ProgressBar from '../components/ui/ProgressBar'

export default function GoalsPage() {
  const user = useAuthStore((s) => s.user)
  const { goals, badges, addGoal, updateGoal, deleteGoal } = useDataStore()
  const [modalOpen, setModalOpen] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  const onSubmit = async (data) => {
    const { error } = await addGoal({
      title: data.title,
      target: Number(data.target),
      progress: 0,
      status: 'active',
    }, user.id)
    if (error) toast.error(error.message)
    else {
      toast.success('Goal created!')
      setModalOpen(false)
      reset()
    }
  }

  const updateProgress = async (goal, delta) => {
    const newProgress = Math.max(0, Math.min(goal.target, goal.progress + delta))
    const status = newProgress >= goal.target ? 'completed' : 'active'
    const { error } = await updateGoal(goal.id, { progress: newProgress, status })
    if (error) toast.error(error.message)
    else if (status === 'completed') toast.success('Goal completed! 🎉')
  }

  const markComplete = async (goal) => {
    const { error } = await updateGoal(goal.id, { progress: goal.target, status: 'completed' })
    if (error) toast.error(error.message)
    else toast.success('Goal completed! 🎉')
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this goal?')) return
    const { error } = await deleteGoal(id)
    if (error) toast.error(error.message)
    else toast.success('Goal deleted')
  }

  const activeGoals = goals.filter((g) => g.status === 'active')
  const completedGoals = goals.filter((g) => g.status === 'completed')

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Academic Goals</h1>
          <p className="page-subtitle">Set targets and track your progress</p>
        </div>
        <button onClick={() => { reset(); setModalOpen(true) }} className="btn-primary">
          <HiOutlinePlus className="h-5 w-5" /> Create Goal
        </button>
      </div>

      {badges.length > 0 && (
        <div className="glass-card p-5">
          <h2 className="mb-4 font-semibold text-slate-900 dark:text-white">Achievement Badges</h2>
          <div className="flex flex-wrap gap-3">
            {badges.map((b) => {
              const def = BADGE_DEFINITIONS[b.badge_type]
              return def ? (
                <div key={b.id} className="flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-2 dark:bg-indigo-950/30">
                  <span className="text-2xl">{def.icon}</span>
                  <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">{def.label}</span>
                </div>
              ) : null
            })}
          </div>
        </div>
      )}

      {goals.length === 0 ? (
        <EmptyState title="No goals yet" description="Create academic goals to stay motivated" action={<button onClick={() => setModalOpen(true)} className="btn-primary"><HiOutlinePlus /> Create Goal</button>} />
      ) : (
        <>
          {activeGoals.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-slate-500">Active Goals</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {activeGoals.map((goal, i) => (
                  <motion.div key={goal.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-card p-5">
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold text-slate-900 dark:text-white">{goal.title}</h3>
                      <div className="flex gap-1">
                        <button onClick={() => markComplete(goal)} className="rounded-lg p-1.5 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30" title="Mark complete"><HiOutlineCheck className="h-4 w-4" /></button>
                        <button onClick={() => handleDelete(goal.id)} className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"><HiOutlineTrash className="h-4 w-4" /></button>
                      </div>
                    </div>
                    <div className="mt-4">
                      <ProgressBar value={goal.progress} max={goal.target} color="indigo" />
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => updateProgress(goal, -1)} className="btn-secondary flex-1 text-xs">-1</button>
                      <button onClick={() => updateProgress(goal, 1)} className="btn-primary flex-1 text-xs">+1</button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {completedGoals.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-slate-500">Completed Goals</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {completedGoals.map((goal) => (
                  <div key={goal.id} className="glass-card p-5 opacity-75">
                    <div className="flex items-center gap-2">
                      <HiOutlineCheck className="h-5 w-5 text-emerald-500" />
                      <h3 className="font-semibold text-slate-500 line-through">{goal.title}</h3>
                    </div>
                    <ProgressBar value={goal.target} max={goal.target} color="emerald" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Create Goal">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label-text">Goal Title</label>
            <input {...register('title', { required: 'Required' })} className="input-field" placeholder="e.g. Study 4 Hours Daily" />
            {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title.message}</p>}
          </div>
          <div>
            <label className="label-text">Target Value</label>
            <input type="number" min="1" {...register('target', { required: 'Required', min: 1 })} className="input-field" placeholder="e.g. 100" />
          </div>
          <button type="submit" className="btn-primary w-full">Create Goal</button>
        </form>
      </Modal>
    </div>
  )
}

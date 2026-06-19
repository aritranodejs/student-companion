import { useRef } from 'react'
import toast from 'react-hot-toast'
import { HiOutlineSun, HiOutlineMoon, HiOutlineDownload, HiOutlineUpload, HiOutlineTrash } from 'react-icons/hi'
import { useAuthStore, useDataStore, useThemeStore } from '../stores'
import { exportToCSV, parseCSV } from '../utils/helpers'
import { supabase } from '../lib/supabase'

export default function SettingsPage() {
  const { user } = useAuthStore()
  const { theme, setTheme } = useThemeStore()
  const { attendance, assignments, semesters, studySessions, exams, goals, fetchAll } = useDataStore()
  const importRef = useRef(null)

  const handleExport = () => {
    const data = {
      attendance,
      assignments,
      semesters,
      study_sessions: studySessions,
      exams,
      goals,
      exported_at: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `student-companion-export-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)

    if (attendance.length) exportToCSV(attendance, 'attendance.csv')
    if (assignments.length) exportToCSV(assignments, 'assignments.csv')
    toast.success('Data exported successfully!')
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    try {
      const text = await file.text()
      let data
      if (file.name.endsWith('.json')) {
        data = JSON.parse(text)
      } else if (file.name.endsWith('.csv')) {
        const rows = parseCSV(text)
        toast.success(`Parsed ${rows.length} rows from CSV. Import JSON for full restore.`)
        return
      } else {
        toast.error('Unsupported file format. Use JSON or CSV.')
        return
      }

      const tables = [
        { key: 'attendance', table: 'attendance' },
        { key: 'assignments', table: 'assignments' },
        { key: 'study_sessions', table: 'study_sessions' },
        { key: 'exams', table: 'exams' },
        { key: 'goals', table: 'goals' },
      ]

      for (const { key, table } of tables) {
        if (data[key]?.length) {
          const rows = data[key].map(({ id, user_id, created_at, ...rest }) => ({
            ...rest,
            user_id: user.id,
          }))
          await supabase.from(table).insert(rows)
        }
      }

      if (data.semesters?.length) {
        for (const sem of data.semesters) {
          const { subjects, id, user_id, created_at, ...semData } = sem
          const { data: newSem } = await supabase.from('semesters').insert({ ...semData, user_id: user.id }).select().single()
          if (newSem && subjects?.length) {
            const subRows = subjects.map(({ id, semester_id, ...sub }) => ({
              ...sub,
              semester_id: newSem.id,
            }))
            await supabase.from('subjects').insert(subRows)
          }
        }
      }

      await fetchAll(user.id)
      toast.success('Data imported successfully!')
    } catch (err) {
      toast.error('Import failed: ' + err.message)
    }
    e.target.value = ''
  }

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure? This will permanently delete your account and all data.')) return
    if (!confirm('This action cannot be undone. Continue?')) return
    toast.error('Account deletion requires Supabase admin setup. Contact support.')
  }

  const settingsSections = [
    {
      title: 'Appearance',
      items: [
        { icon: HiOutlineSun, label: 'Light Mode', action: () => setTheme('light'), active: theme === 'light' },
        { icon: HiOutlineMoon, label: 'Dark Mode', action: () => setTheme('dark'), active: theme === 'dark' },
      ],
    },
    {
      title: 'Data Management',
      items: [
        { icon: HiOutlineDownload, label: 'Export Data', action: handleExport, description: 'Download JSON + CSV files' },
        { icon: HiOutlineUpload, label: 'Import Data', action: () => importRef.current?.click(), description: 'Restore from JSON backup' },
      ],
    },
    {
      title: 'Danger Zone',
      items: [
        { icon: HiOutlineTrash, label: 'Delete Account', action: handleDeleteAccount, danger: true },
      ],
    },
  ]

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Customize your experience</p>
      </div>

      <input ref={importRef} type="file" accept=".json,.csv" onChange={handleImport} className="hidden" />

      {settingsSections.map((section) => (
        <div key={section.title} className="glass-card overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{section.title}</h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {section.items.map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                className={`flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                  item.danger ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                <item.icon className={`h-5 w-5 ${item.active ? 'text-indigo-500' : ''}`} />
                <div className="flex-1">
                  <p className={`text-sm font-medium ${item.active ? 'text-indigo-600 dark:text-indigo-400' : ''}`}>{item.label}</p>
                  {item.description && <p className="text-xs text-slate-400">{item.description}</p>}
                </div>
                {item.active && <span className="h-2 w-2 rounded-full bg-indigo-500" />}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

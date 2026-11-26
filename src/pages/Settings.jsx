import { useEffect, useState } from 'react'
import { CheckCircle2, KeyRound, Moon, ShieldAlert, ShieldCheck, Sun, UserRound } from 'lucide-react'
import { Badge, Card, CardHeader, PageHeader } from '../components/ui'
import { useAuth } from '../auth/AuthContext'
import { api } from '../lib/api'
import appPackage from '../../package.json'

const ROLE_LABEL = { admin: 'Administrator', manager: 'Manager', user: 'Read-only User' }
const ROLE_TONE = { admin: 'brand', manager: 'amber', user: 'neutral' }

function Notice({ children }) {
  return (
    <div
      className="flex items-start gap-2 rounded-[10px] px-3 py-2.5 text-[12.5px]"
      style={{ background: 'var(--green-soft)', color: 'var(--green)' }}
      role="status"
    >
      <CheckCircle2 size={14} className="mt-0.5 flex-none" />
      <span>{children}</span>
    </div>
  )
}

function ProfileCard({ notify }) {
  const { user, updateProfile } = useAuth()
  const [name, setName] = useState(user?.name || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    setName(user?.name || '')
  }, [user?.name])

  const submit = async (event) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setNotice('')
      return setError('Enter your name')
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await updateProfile({ name: trimmed })
      setNotice('Profile updated.')
      notify?.('Profile updated')
    } catch (err) {
      setError(err.fields?.name || err.message || 'Could not update your profile')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader title="Profile" subtitle="Your account details. Email and role are managed by an administrator." />
      <form onSubmit={submit} className="p-5 pt-3" noValidate>
        <div className="flex items-center gap-3 pb-4">
          <span className="grid h-11 w-11 flex-none place-items-center rounded-full" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            <UserRound size={19} strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <div className="truncate text-[14px] font-medium">{user?.name || 'Account'}</div>
            <div className="truncate text-[12px] faint">{user?.email}</div>
          </div>
          <Badge tone={ROLE_TONE[user?.role] || 'neutral'}>{ROLE_LABEL[user?.role] || 'User'}</Badge>
        </div>

        <div className="form-grid">
          <label className="field span-2">
            <span className="field-label">Display name</span>
            <input
              className="input"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setError('')
                setNotice('')
              }}
              maxLength={120}
              autoComplete="name"
            />
            {error ? <span className="field-error">{error}</span> : null}
          </label>
          <label className="field">
            <span className="field-label">Email address</span>
            <input className="input" value={user?.email || ''} readOnly style={{ background: 'var(--panel-2)', color: 'var(--text-2)' }} />
          </label>
          <label className="field">
            <span className="field-label">Role</span>
            <input className="input" value={ROLE_LABEL[user?.role] || 'User'} readOnly style={{ background: 'var(--panel-2)', color: 'var(--text-2)' }} />
          </label>
        </div>

        {notice ? <div className="mt-3"><Notice>{notice}</Notice></div> : null}

        <div className="mt-4 flex justify-end">
          <button type="submit" className="btn btn-primary" disabled={busy || name.trim() === (user?.name || '')}>
            {busy ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Card>
  )
}

function PasswordCard({ notify }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
    setFormError('')
    setNotice('')
  }

  const submit = async (event) => {
    event.preventDefault()
    const next = {}
    if (!form.currentPassword) next.currentPassword = 'Enter your current password'
    if (!form.newPassword) next.newPassword = 'Enter a new password'
    else if (form.newPassword.length < 8) next.newPassword = 'Use at least 8 characters'
    else if (!/[A-Za-z]/.test(form.newPassword) || !/[0-9]/.test(form.newPassword)) {
      next.newPassword = 'Include at least one letter and one number'
    }
    if (form.confirmPassword !== form.newPassword) next.confirmPassword = 'Passwords do not match'
    setErrors(next)
    if (Object.keys(next).length) return

    setBusy(true)
    setFormError('')
    setNotice('')
    try {
      await api.post('/auth/change-password', form)
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setNotice('Password updated. Use it the next time you sign in.')
      notify?.('Password updated')
    } catch (err) {
      if (err.fields) setErrors(err.fields)
      setFormError(err.message || 'Could not update your password')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader title="Password" subtitle="Confirm your current password before choosing a new one." />
      <form onSubmit={submit} className="p-5 pt-3" noValidate>
        <div className="flex flex-col gap-3">
          <label className="field">
            <span className="field-label">Current password</span>
            <input
              className="input"
              type="password"
              value={form.currentPassword}
              onChange={set('currentPassword')}
              autoComplete="current-password"
              aria-invalid={errors.currentPassword ? 'true' : undefined}
            />
            {errors.currentPassword ? <span className="field-error">{errors.currentPassword}</span> : null}
          </label>
          <label className="field">
            <span className="field-label">New password</span>
            <input
              className="input"
              type="password"
              value={form.newPassword}
              onChange={set('newPassword')}
              autoComplete="new-password"
              aria-invalid={errors.newPassword ? 'true' : undefined}
            />
            {errors.newPassword ? (
              <span className="field-error">{errors.newPassword}</span>
            ) : (
              <span className="field-hint">At least 8 characters, with a letter and a number.</span>
            )}
          </label>
          <label className="field">
            <span className="field-label">Confirm new password</span>
            <input
              className="input"
              type="password"
              value={form.confirmPassword}
              onChange={set('confirmPassword')}
              autoComplete="new-password"
              aria-invalid={errors.confirmPassword ? 'true' : undefined}
            />
            {errors.confirmPassword ? <span className="field-error">{errors.confirmPassword}</span> : null}
          </label>
        </div>

        {formError ? <div className="auth-error mt-3" role="alert">{formError}</div> : null}
        {notice ? <div className="mt-3"><Notice>{notice}</Notice></div> : null}

        <div className="mt-4 flex justify-end">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            <KeyRound size={14} /> {busy ? 'Updating…' : 'Update Password'}
          </button>
        </div>
      </form>
    </Card>
  )
}

function AppearanceCard({ theme, setTheme }) {
  const active = theme === 'dark' ? 'dark' : 'light'
  const options = [
    { value: 'light', label: 'Light Mode', description: 'Bright surfaces for day-to-day use', icon: Sun },
    { value: 'dark', label: 'Dark Mode', description: 'Lower-light interface for long sessions', icon: Moon },
  ]

  return (
    <Card>
      <CardHeader title="Appearance" subtitle="Applied immediately and remembered on this device." />
      <div className="grid gap-3 p-5 pt-3 sm:grid-cols-2">
        {options.map((option) => {
          const Icon = option.icon
          const selected = active === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setTheme(option.value)}
              aria-pressed={selected}
              className="flex items-start gap-3 rounded-[10px] border p-3.5 text-left transition"
              style={
                selected
                  ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)', color: 'var(--text)' }
                  : { background: 'var(--panel)' }
              }
            >
              <span
                className="grid h-9 w-9 flex-none place-items-center rounded-[9px]"
                style={{ background: selected ? 'var(--panel)' : 'var(--panel-2)', color: selected ? 'var(--accent)' : 'var(--text-3)' }}
              >
                <Icon size={16} strokeWidth={1.8} />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-[13.5px] font-medium">
                  {option.label}
                  {selected ? <CheckCircle2 size={13} style={{ color: 'var(--accent)' }} /> : null}
                </span>
                <span className="mt-0.5 block text-[12px] faint">{option.description}</span>
              </span>
            </button>
          )
        })}
      </div>
    </Card>
  )
}

function AboutCard() {
  const rows = [
    ['Application', 'brillo'],
    ['Version', appPackage.version],
    ['Platform', 'Enterprise IT Assessment Management'],
    ['Currency', 'Indian Rupees (₹)'],
  ]

  return (
    <Card>
      <CardHeader title="Application Information" subtitle="Release and configuration details." />
      <div className="p-5 pt-3">
        <dl className="divide-y">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 py-2.5 text-[13px]">
              <dt className="faint">{label}</dt>
              <dd className="truncate font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 flex items-start gap-2 border-t pt-3 text-[11.5px] faint">
          <ShieldCheck size={13} className="mt-0.5 flex-none" style={{ color: 'var(--accent)' }} />
          Amounts are stored exactly as imported and are never converted. Access to each module is enforced by the API on every
          request.
        </p>
      </div>
    </Card>
  )
}

function DataCard({ notify, onCleared }) {
  const { isAdmin } = useAuth()
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  if (!isAdmin) return null

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const data = await api.post('/admin/clear-data', { confirm })
      const removed = data.removed || {}
      setNotice(
        `Removed ${removed.assessments || 0} assessment record(s), ${removed.vendors || 0} vendor(s), ${removed.software || 0} software record(s) and ${removed.imports || 0} import history row(s).`,
      )
      setConfirm('')
      notify?.('Business data cleared')
      onCleared?.()
    } catch (err) {
      setError(err.message || 'Could not clear business data')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card style={{ borderColor: 'var(--red-soft)' }}>
      <CardHeader
        title="Clear Business Data"
        subtitle="Administrator only. Permanently removes assessments, vendors, SAM software records and import history."
      />
      <form onSubmit={submit} className="p-5 pt-3" noValidate>
        <div className="flex items-start gap-2 rounded-[10px] px-3 py-2.5 text-[12.5px]" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}>
          <ShieldAlert size={14} className="mt-0.5 flex-none" />
          <span>
            User accounts, roles and settings are kept. This is for a deliberate fresh start and cannot be undone. Uploading a new
            Excel file does not delete existing records.
          </span>
        </div>
        <label className="field mt-4">
          <span className="field-label">Type CLEAR to confirm</span>
          <input
            className="input"
            value={confirm}
            onChange={(event) => { setConfirm(event.target.value); setError('') }}
            placeholder="CLEAR"
            autoComplete="off"
            aria-invalid={error ? 'true' : undefined}
          />
        </label>
        {error ? <div className="auth-error mt-3" role="alert">{error}</div> : null}
        {notice ? <div className="mt-3"><Notice>{notice}</Notice></div> : null}
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            className="btn"
            style={{ color: 'var(--red)', borderColor: 'var(--red-soft)' }}
            disabled={busy || confirm.trim().toUpperCase() !== 'CLEAR'}
          >
            <ShieldAlert size={14} /> {busy ? 'Clearing…' : 'Clear all business data'}
          </button>
        </div>
      </form>
    </Card>
  )
}

export default function Settings({ theme, setTheme, notify, onCleared }) {
  return (
    <div className="fade-in">
      <PageHeader
        title="Settings"
        description="Manage your profile, password and interface preference. Administrative options live in Create Users and are limited to administrators."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <ProfileCard notify={notify} />
        <PasswordCard notify={notify} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <AppearanceCard theme={theme} setTheme={setTheme} />
        <AboutCard />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <DataCard notify={notify} onCleared={onCleared} />
      </div>
    </div>
  )
}

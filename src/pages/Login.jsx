import { useState } from 'react'
import { Eye, EyeOff, Lock, Mail, ShieldCheck, User } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function validate({ mode, name, email, password, confirm }) {
  const errors = {}
  if (mode === 'signup' && !String(name).trim()) errors.name = 'Enter your full name'
  if (!email.trim()) errors.email = 'Email is required'
  else if (!EMAIL_RE.test(email.trim())) errors.email = 'Enter a valid email address'
  if (!password) errors.password = 'Password is required'
  else if (mode === 'signup' && password.length < 8) errors.password = 'Use at least 8 characters'
  else if (mode === 'signup' && (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)))
    errors.password = 'Include at least one letter and one number'
  if (mode === 'signup' && confirm !== password) errors.confirm = 'Passwords do not match'
  return errors
}

function Field({ label, error, children, hint }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  )
}

export default function Login() {
  const { login, signup } = useAuth()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
    setFormError('')
  }

  const switchMode = (next) => {
    setMode(next)
    setErrors({})
    setFormError('')
    setForm((prev) => ({ ...prev, confirm: '' }))
  }

  const submit = async (event) => {
    event.preventDefault()
    const nextErrors = validate({ mode, ...form })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setBusy(true)
    setFormError('')
    try {
      if (mode === 'login') await login(form.email.trim(), form.password)
      else await signup({ name: form.name.trim(), email: form.email.trim(), password: form.password })
    } catch (error) {
      if (error.fields) setErrors(error.fields)
      setFormError(error.message || 'Could not sign in')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <div className="brand-lockup">
          <span className="brand-wordmark" aria-label="brillo">
            bri<span className="brand-ll">
              ll<span className="brand-dots" aria-hidden="true"><i /><i /></span>
            </span>
            o
          </span>
          <span className="brand-tagline">IT Assessment Management</span>
        </div>

        <div className="auth-aside-copy">
          <h1>Asset assessments,<br />under control.</h1>
          <p>
            Upload your assessment register, track every quarter against the real assessment date, and keep vendor records in one auditable place.
          </p>
          <ul>
            <li><ShieldCheck size={15} /> Role-based access for admins, managers and staff</li>
            <li><ShieldCheck size={15} /> Excel and manual entry on one validated schema</li>
            <li><ShieldCheck size={15} /> Quarterly and yearly reporting from live data</li>
          </ul>
        </div>

        <p className="auth-aside-foot">Secure sessions · Hashed passwords · Server-side authorisation</p>
      </aside>

      <main className="auth-main">
        <div className="auth-panel">
          <div className="auth-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'on' : ''} onClick={() => switchMode('login')}>
              Sign in
            </button>
            <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'on' : ''} onClick={() => switchMode('signup')}>
              Create account
            </button>
          </div>

          <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
          <p className="auth-sub">
            {mode === 'login' ? 'Sign in with your work email to open the dashboard.' : 'New accounts start with read-only access; an administrator can raise your role.'}
          </p>

          <form onSubmit={submit} noValidate>
            {mode === 'signup' ? (
              <Field label="Full name" error={errors.name}>
                <div className="input-group">
                  <User size={15} />
                  <input className="input" value={form.name} onChange={set('name')} placeholder="Sanjay Kiruba" autoComplete="name" />
                </div>
              </Field>
            ) : null}

            <Field label="Work email" error={errors.email}>
              <div className="input-group">
                <Mail size={15} />
                <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="you@company.com" autoComplete="email" />
              </div>
            </Field>

            <Field label="Password" error={errors.password} hint={mode === 'signup' ? 'At least 8 characters, with a letter and a number.' : undefined}>
              <div className="input-group">
                <Lock size={15} />
                <input
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                  placeholder="••••••••"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                <button type="button" className="input-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Field>

            {mode === 'signup' ? (
              <Field label="Confirm password" error={errors.confirm}>
                <div className="input-group">
                  <Lock size={15} />
                  <input
                    className="input"
                    type={showPassword ? 'text' : 'password'}
                    value={form.confirm}
                    onChange={set('confirm')}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>
              </Field>
            ) : null}

            {formError ? <div className="auth-error" role="alert">{formError}</div> : null}

            <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
              {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="auth-switch">
            {mode === 'login' ? 'Need an account?' : 'Already registered?'}{' '}
            <button type="button" onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}>
              {mode === 'login' ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </div>
      </main>
    </div>
  )
}

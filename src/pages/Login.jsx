import { useState } from 'react'
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function BrandWordmark({ className = '' }) {
  return (
    <span className={`brand-wordmark ${className}`} aria-label="brillo">
      bri
      <span className="brand-ll">
        ll
        <span className="brand-dots" aria-hidden="true"><i /><i /></span>
      </span>
      o
    </span>
  )
}

export default function Login() {
  const { login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
    setFormError('')
  }

  const submit = async (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (!form.email.trim()) nextErrors.email = 'Email is required'
    else if (!EMAIL_RE.test(form.email.trim())) nextErrors.email = 'Enter a valid email address'
    if (!form.password) nextErrors.password = 'Password is required'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setBusy(true)
    setFormError('')
    try {
      await login(form.email.trim(), form.password)
    } catch (error) {
      if (error.fields) setErrors(error.fields)
      setFormError(error.message || 'Could not sign in. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-shell">
      <div className="login-bg" aria-hidden="true">
        <span className="login-glow login-glow-a" />
        <span className="login-glow login-glow-b" />
        <span className="login-ring login-ring-a" />
        <span className="login-ring login-ring-b" />
        <span className="login-line" />
      </div>

      <header className="login-top">
        <BrandWordmark className="login-wordmark" />
        <span className="login-top-meta">IT Assessment Management</span>
      </header>

      <main className="login-main">
        <section className="login-card" aria-labelledby="login-title">
          <span className="login-eyebrow">
            <ShieldCheck size={13} strokeWidth={1.9} />
            Secure Access
          </span>

          <h1 id="login-title" className="login-title">Welcome Back</h1>
          <p className="login-sub">
            Sign in with your work account to open your assessment workspace.
          </p>

          <form className="login-form" onSubmit={submit} noValidate aria-busy={busy}>
            <label className="login-field" htmlFor="login-email">
              <span className="login-label">Work email</span>
              <span className={`login-input-wrap ${errors.email ? 'invalid' : ''}`}>
                <Mail size={16} className="login-input-icon" aria-hidden="true" />
                <input
                  id="login-email"
                  className="login-input"
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  placeholder="you@company.com"
                  autoComplete="email"
                  autoFocus
                  aria-invalid={errors.email ? 'true' : undefined}
                  aria-describedby={errors.email ? 'login-email-error' : undefined}
                />
              </span>
              {errors.email ? (
                <span className="login-field-error" id="login-email-error">{errors.email}</span>
              ) : null}
            </label>

            <label className="login-field" htmlFor="login-password">
              <span className="login-label">Password</span>
              <span className={`login-input-wrap ${errors.password ? 'invalid' : ''}`}>
                <Lock size={16} className="login-input-icon" aria-hidden="true" />
                <input
                  id="login-password"
                  className="login-input login-input-password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  aria-invalid={errors.password ? 'true' : undefined}
                  aria-describedby={errors.password ? 'login-password-error' : undefined}
                />
                <button
                  type="button"
                  className="login-reveal"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
              {errors.password ? (
                <span className="login-field-error" id="login-password-error">{errors.password}</span>
              ) : null}
            </label>

            {formError ? (
              <div className="login-error" role="alert">
                <AlertCircle size={15} strokeWidth={2} aria-hidden="true" />
                <span>{formError}</span>
              </div>
            ) : null}

            <button type="submit" className="login-submit" disabled={busy}>
              {busy ? (
                <>
                  <span className="login-spinner" aria-hidden="true" />
                  Signing in…
                </>
              ) : (
                <>
                  Login
                  <ArrowRight size={16} strokeWidth={2} />
                </>
              )}
            </button>
          </form>

          <p className="login-note">
            Accounts are created by an administrator. Contact your IT team if you need access.
          </p>
        </section>

        <p className="login-assurance">
          <ShieldCheck size={13} strokeWidth={1.9} aria-hidden="true" />
          Role-based access · Secure sessions · Hashed passwords
        </p>
      </main>

      <footer className="login-footer">
        <span>© {new Date().getFullYear()} brillo</span>
        <span className="login-footer-sep" aria-hidden="true" />
        <span>Enterprise IT Assessment Platform</span>
      </footer>
    </div>
  )
}

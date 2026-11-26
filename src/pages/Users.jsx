import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, KeyRound, Pencil, Search, ShieldCheck, Trash2, UserCog, UserPlus, UserX } from 'lucide-react'
import { Badge, Card, CardHeader, EmptyState, PageHeader } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../auth/AuthContext'

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'user', label: 'User' },
]

const ROLE_TONE = { admin: 'brand', manager: 'amber', user: 'neutral' }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const passwordProblem = (password) => {
  if (!password) return 'Password is required'
  if (password.length < 8) return 'Use at least 8 characters'
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'Include at least one letter and one number'
  return null
}

function CreateUserForm({ onCreated, notify }) {
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '', role: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState(null)
  const [busy, setBusy] = useState(false)

  const set = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
    setFormError('')
  }

  const submit = async (event) => {
    event.preventDefault()
    const next = {}
    if (!form.email.trim()) next.email = 'Email is required'
    else if (!EMAIL_RE.test(form.email.trim())) next.email = 'Enter a valid email address'
    const problem = passwordProblem(form.password)
    if (problem) next.password = problem
    if (!form.confirmPassword) next.confirmPassword = 'Confirm the password'
    else if (form.confirmPassword !== form.password) next.confirmPassword = 'Passwords do not match'
    if (!form.role) next.role = 'Choose a role'
    setErrors(next)
    if (Object.keys(next).length) return

    setBusy(true)
    setFormError('')
    setSuccess(null)
    try {
      const data = await api.post('/users', { ...form, email: form.email.trim() })
      setSuccess({ email: data.user.email, role: data.user.role })
      setForm({ email: '', password: '', confirmPassword: '', role: '' })
      notify?.(`User ${data.user.email} created`)
      onCreated()
    } catch (error) {
      if (error.fields) setErrors(error.fields)
      setFormError(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mb-4">
      <CardHeader title="Create User" subtitle="Only administrators can create accounts. Passwords are hashed before they are stored." />
      <form onSubmit={submit} className="p-4 pt-2" noValidate>
        <div className="form-grid">
          <label className="field">
            <span className="field-label">User email *</span>
            <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="person@company.com" autoComplete="off" />
            {errors.email ? <span className="field-error">{errors.email}</span> : null}
          </label>
          <label className="field">
            <span className="field-label">Assign role *</span>
            <select className="input" value={form.role} onChange={set('role')}>
              <option value="">Select a role</option>
              {ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
            </select>
            {errors.role ? <span className="field-error">{errors.role}</span> : null}
          </label>
          <label className="field">
            <span className="field-label">Password *</span>
            <input className="input" type="password" value={form.password} onChange={set('password')} placeholder="••••••••" autoComplete="new-password" />
            {errors.password ? <span className="field-error">{errors.password}</span> : <span className="field-hint">At least 8 characters, with a letter and a number.</span>}
          </label>
          <label className="field">
            <span className="field-label">Confirm password *</span>
            <input className="input" type="password" value={form.confirmPassword} onChange={set('confirmPassword')} placeholder="••••••••" autoComplete="new-password" />
            {errors.confirmPassword ? <span className="field-error">{errors.confirmPassword}</span> : null}
          </label>
        </div>

        {formError ? <div className="auth-error mt-3" role="alert">{formError}</div> : null}
        {success ? (
          <div
            className="mt-3 flex items-start gap-2 rounded-[10px] px-3 py-2.5 text-[12px]"
            style={{ background: 'var(--green-soft)', color: 'var(--green)' }}
            role="status"
          >
            <CheckCircle2 size={14} className="mt-0.5 flex-none" />
            <span>
              User <strong>{success.email}</strong> was created with the <strong>{success.role}</strong> role. Share the password securely.
            </span>
          </div>
        ) : null}

        <div className="modal-actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            <UserPlus size={15} /> {busy ? 'Saving…' : 'Save User'}
          </button>
        </div>
      </form>
    </Card>
  )
}

function EditUserModal({ target, isSelf, onClose, onSaved, notify }) {
  const [form, setForm] = useState({
    name: target.name || '',
    email: target.email,
    role: target.role,
    isActive: target.isActive,
  })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
    setFormError('')
  }

  const submit = async (event) => {
    event.preventDefault()
    const next = {}
    if (!form.email.trim()) next.email = 'Email is required'
    else if (!EMAIL_RE.test(form.email.trim())) next.email = 'Enter a valid email address'
    if (!form.role) next.role = 'Choose a role'
    setErrors(next)
    if (Object.keys(next).length) return

    setBusy(true)
    setFormError('')
    try {
      await api.patch(`/users/${target.id}`, { ...form, email: form.email.trim() })
      notify?.(`Updated ${form.email}`)
      onSaved()
    } catch (error) {
      if (error.fields) setErrors(error.fields)
      setFormError(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Edit user">
      <div className="modal">
        <div className="modal-head">
          <h3>Edit User</h3>
          <button type="button" className="btn btn-sm" onClick={onClose}>Close</button>
        </div>
        <form onSubmit={submit} className="modal-body" noValidate>
          <div className="form-grid">
            <label className="field span-2">
              <span className="field-label">Display name</span>
              <input className="input" value={form.name} onChange={set('name')} />
            </label>
            <label className="field span-2">
              <span className="field-label">User email *</span>
              <input className="input" type="email" value={form.email} onChange={set('email')} />
              {errors.email ? <span className="field-error">{errors.email}</span> : null}
            </label>
            <label className="field">
              <span className="field-label">Role *</span>
              <select className="input" value={form.role} onChange={set('role')} disabled={isSelf} title={isSelf ? 'You cannot change your own role' : 'Change role'}>
                {ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
              </select>
              {isSelf ? <span className="field-hint">You cannot change your own role.</span> : null}
              {errors.role ? <span className="field-error">{errors.role}</span> : null}
            </label>
            <div className="field">
              <span className="field-label">Account status</span>
              <span className="flex items-center gap-2 pt-2 text-[12px]">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={set('isActive')}
                  disabled={isSelf}
                  aria-label="Account active"
                />
                <span>{form.isActive ? 'Active' : 'Deactivated'}</span>
              </span>
              {isSelf ? <span className="field-hint">You cannot deactivate your own account.</span> : null}
            </div>
          </div>
          {formError ? <div className="auth-error">{formError}</div> : null}
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Users({ notify }) {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ search: '', role: '' })
  const [editing, setEditing] = useState(null)
  const [resetting, setResetting] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [resetForm, setResetForm] = useState({ password: '', confirmPassword: '' })
  const [actionError, setActionError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get('/users')
      setItems(data.items)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const search = filters.search.trim().toLowerCase()
    return items.filter((item) => {
      if (filters.role && item.role !== filters.role) return false
      if (!search) return true
      return item.email.toLowerCase().includes(search) || String(item.name || '').toLowerCase().includes(search)
    })
  }, [items, filters])

  const toggleActive = async (target) => {
    setActionError('')
    try {
      await api.patch(`/users/${target.id}`, { isActive: !target.isActive })
      notify?.(target.isActive ? `${target.email} deactivated` : `${target.email} activated`)
      load()
    } catch (err) {
      setActionError(err.message)
      notify?.(err.message)
    }
  }

  const confirmDelete = async () => {
    setActionError('')
    try {
      await api.delete(`/users/${deleting.id}`)
      notify?.(`Deleted ${deleting.email}`)
      setDeleting(null)
      load()
    } catch (err) {
      setActionError(err.message)
      notify?.(err.message)
    }
  }

  const resetPassword = async () => {
    const problem = passwordProblem(resetForm.password)
    if (problem) return setActionError(problem)
    if (resetForm.confirmPassword !== resetForm.password) return setActionError('Passwords do not match')
    setActionError('')
    try {
      await api.patch(`/users/${resetting.id}`, resetForm)
      notify?.(`Password updated for ${resetting.email}`)
      setResetting(null)
      setResetForm({ password: '', confirmPassword: '' })
    } catch (err) {
      setActionError(err.message)
    }
  }

  return (
    <div className="fade-in">
      <PageHeader
        title="Create Users"
        description="Create accounts, assign roles, reset passwords and control access. These actions are administrator-only and enforced by the API."
      />

      <CreateUserForm notify={notify} onCreated={load} />

      <Card>
        <CardHeader
          title="Registered Users"
          subtitle={`${filtered.length} of ${items.length} account${items.length === 1 ? '' : 's'}`}
        />

        <div className="filter-bar">
          <div className="input-group">
            <Search size={14} />
            <input
              className="input"
              placeholder="Search by email or name…"
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            />
          </div>
          <select
            className="input input-auto"
            value={filters.role}
            onChange={(event) => setFilters((prev) => ({ ...prev, role: event.target.value }))}
          >
            <option value="">All roles</option>
            {ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
          </select>
          {filters.search || filters.role ? (
            <button type="button" className="btn btn-sm" onClick={() => setFilters({ search: '', role: '' })}>Clear</button>
          ) : null}
        </div>

        {error ? <div className="p-4 text-[12.5px]" style={{ color: 'var(--red)' }}>{error}</div> : null}
        {actionError ? <div className="px-4 pb-3 text-[12px]" style={{ color: 'var(--red)' }} role="alert">{actionError}</div> : null}

        {!loading && !filtered.length && !error ? (
          <EmptyState
            icon={UserCog}
            title={items.length ? 'No users match this search' : 'No accounts yet'}
            description={items.length ? 'Clear or widen the filters to see every account.' : 'Use the form above to create the first account.'}
          />
        ) : null}

        {filtered.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const isSelf = item.id === user?.id
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="font-medium">{item.email}</div>
                        {isSelf ? <div className="text-[10.5px] faint">This is your account</div> : null}
                      </td>
                      <td className="faint">{item.name || '—'}</td>
                      <td><Badge tone={ROLE_TONE[item.role] || 'neutral'}>{item.role}</Badge></td>
                      <td><Badge tone={item.isActive ? 'green' : 'red'}>{item.isActive ? 'Active' : 'Deactivated'}</Badge></td>
                      <td className="faint">{new Date(item.createdAt).toLocaleDateString('en-GB')}</td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => { setActionError(''); setEditing(item) }}
                            aria-label={`Edit ${item.email}`}
                            title="Edit user"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => { setActionError(''); setResetForm({ password: '', confirmPassword: '' }); setResetting(item) }}
                            aria-label={`Reset password for ${item.email}`}
                            title="Reset password"
                          >
                            <KeyRound size={14} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            disabled={isSelf}
                            onClick={() => toggleActive(item)}
                            aria-label={`${item.isActive ? 'Deactivate' : 'Activate'} ${item.email}`}
                            title={isSelf ? 'You cannot deactivate your own account' : item.isActive ? 'Deactivate account' : 'Activate account'}
                          >
                            <UserX size={14} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            style={{ color: 'var(--red)' }}
                            disabled={isSelf}
                            onClick={() => { setActionError(''); setDeleting(item) }}
                            aria-label={`Delete ${item.email}`}
                            title={isSelf ? 'You cannot delete your own account' : 'Delete account'}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      <Card className="mt-4">
        <CardHeader title="Role Permissions" subtitle="Enforced by the API on every request, not only in the interface" />
        <div className="p-4 pt-2 text-[12px]">
          <div className="flex items-start gap-2">
            <ShieldCheck size={15} className="mt-0.5" style={{ color: 'var(--accent)' }} />
            <div className="space-y-1.5">
              <p><strong>Admin</strong> — manage users, vendors, assessments, Excel imports and all modules.</p>
              <p><strong>Manager</strong> — view dashboard, assessment records, reports and vendors. No writes.</p>
              <p><strong>User</strong> — read-only access to dashboard, assessments, vendors and reports.</p>
            </div>
          </div>
        </div>
      </Card>

      {editing ? (
        <EditUserModal
          target={editing}
          isSelf={editing.id === user?.id}
          notify={notify}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      ) : null}

      {resetting ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Reset password">
          <div className="modal">
            <div className="modal-head">
              <h3>Reset Password</h3>
              <button type="button" className="btn btn-sm" onClick={() => setResetting(null)}>Close</button>
            </div>
            <div className="modal-body">
              <p className="text-[12px] muted">
                Set a new password for <strong>{resetting.email}</strong>. Share it securely and ask them to sign in with it.
              </p>
              <div className="form-grid mt-3">
                <label className="field">
                  <span className="field-label">New password</span>
                  <input
                    className="input"
                    type="password"
                    value={resetForm.password}
                    onChange={(event) => setResetForm((prev) => ({ ...prev, password: event.target.value }))}
                    autoComplete="new-password"
                  />
                  <span className="field-hint">At least 8 characters, with a letter and a number.</span>
                </label>
                <label className="field">
                  <span className="field-label">Confirm new password</span>
                  <input
                    className="input"
                    type="password"
                    value={resetForm.confirmPassword}
                    onChange={(event) => setResetForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                    autoComplete="new-password"
                  />
                </label>
              </div>
              {actionError ? <div className="auth-error">{actionError}</div> : null}
              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setResetting(null)}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={resetPassword} disabled={!resetForm.password || !resetForm.confirmPassword}>
                  Update password
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {deleting ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Delete user">
          <div className="modal">
            <div className="modal-head">
              <h3>Delete User Account</h3>
              <button type="button" className="btn btn-sm" onClick={() => setDeleting(null)}>Close</button>
            </div>
            <div className="modal-body">
              <p className="text-[12.5px]">
                Delete <strong>{deleting.email}</strong>? They will no longer be able to sign in. This cannot be undone.
              </p>
              {actionError ? <div className="auth-error">{actionError}</div> : null}
              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setDeleting(null)}>Cancel</button>
                <button type="button" className="btn btn-primary" style={{ background: 'var(--red)', borderColor: 'var(--red)' }} onClick={confirmDelete}>
                  Delete account
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

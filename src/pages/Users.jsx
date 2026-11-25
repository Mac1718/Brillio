import { useCallback, useEffect, useState } from 'react'
import { KeyRound, Plus, ShieldCheck, Trash2, UserCog } from 'lucide-react'
import { Badge, Card, CardHeader, EmptyState, PageHeader } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../auth/AuthContext'

const ROLES = [
  { value: 'admin', label: 'Admin — full control' },
  { value: 'manager', label: 'Manager — read-only' },
  { value: 'user', label: 'User — read-only' },
]

const ROLE_TONE = { admin: 'brand', manager: 'amber', user: 'neutral' }

const EMPTY = { name: '', email: '', password: '', role: 'user' }

function UserForm({ onClose, onSaved, notify }) {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setFormError('')
    try {
      await api.post('/users', form)
      notify?.('User account created')
      onSaved()
    } catch (error) {
      if (error.fields) setErrors(error.fields)
      setFormError(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Create user">
      <div className="modal">
        <div className="modal-head">
          <h3>Create user account</h3>
          <button type="button" className="btn btn-sm" onClick={onClose}>Close</button>
        </div>
        <form onSubmit={submit} className="modal-body" noValidate>
          <div className="form-grid">
            <label className="field span-2">
              <span className="field-label">Full name *</span>
              <input className="input" value={form.name} onChange={set('name')} />
              {errors.name ? <span className="field-error">{errors.name}</span> : null}
            </label>
            <label className="field span-2">
              <span className="field-label">Work email *</span>
              <input className="input" type="email" value={form.email} onChange={set('email')} />
              {errors.email ? <span className="field-error">{errors.email}</span> : null}
            </label>
            <label className="field">
              <span className="field-label">Temporary password *</span>
              <input className="input" type="text" value={form.password} onChange={set('password')} />
              {errors.password ? <span className="field-error">{errors.password}</span> : <span className="field-hint">Minimum 8 characters with a letter and a number.</span>}
            </label>
            <label className="field">
              <span className="field-label">Role</span>
              <select className="input" value={form.role} onChange={set('role')}>
                {ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
              </select>
            </label>
          </div>
          {formError ? <div className="auth-error">{formError}</div> : null}
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
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
  const [creating, setCreating] = useState(false)
  const [resetting, setResetting] = useState(null)
  const [newPassword, setNewPassword] = useState('')

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

  const changeRole = async (target, role) => {
    try {
      await api.patch(`/users/${target.id}`, { role })
      notify?.(`${target.name} is now ${role}`)
      load()
    } catch (err) {
      notify?.(err.message)
    }
  }

  const toggleActive = async (target) => {
    try {
      await api.patch(`/users/${target.id}`, { isActive: !target.isActive })
      notify?.(target.isActive ? `${target.name} disabled` : `${target.name} enabled`)
      load()
    } catch (err) {
      notify?.(err.message)
    }
  }

  const remove = async (target) => {
    if (!window.confirm(`Delete the account for ${target.name}? This cannot be undone.`)) return
    try {
      await api.delete(`/users/${target.id}`)
      notify?.('User deleted')
      load()
    } catch (err) {
      notify?.(err.message)
    }
  }

  const resetPassword = async () => {
    if (!newPassword) return
    try {
      await api.patch(`/users/${resetting.id}`, { password: newPassword })
      notify?.(`Password updated for ${resetting.name}`)
      setResetting(null)
      setNewPassword('')
    } catch (err) {
      notify?.(err.message)
    }
  }

  return (
    <div className="fade-in">
      <PageHeader
        title="User management"
        description="Create accounts, assign roles and disable access. Role changes take effect on the user's next request."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            <Plus size={15} /> Create user
          </button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {[
          { role: 'admin', label: 'Administrators', hint: 'Full control' },
          { role: 'manager', label: 'Managers', hint: 'Read-only' },
          { role: 'user', label: 'Users', hint: 'Read-only' },
        ].map((group) => (
          <div key={group.role} className="card px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] faint">{group.label}</span>
              <Badge tone={ROLE_TONE[group.role]}>{group.hint}</Badge>
            </div>
            <div className="mono mt-1 text-[19px] font-semibold tracking-[-0.02em]">
              {items.filter((item) => item.role === group.role).length}
            </div>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader title="Accounts" subtitle={`${items.length} user${items.length === 1 ? '' : 's'}`} />
        {error ? <div className="p-4 text-[12.5px]" style={{ color: 'var(--red)' }}>{error}</div> : null}
        {!loading && !items.length && !error ? <EmptyState icon={UserCog} title="No accounts" description="Create the first account to get started." /> : null}

        {items.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isSelf = item.id === user?.id
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="font-medium">{item.name} {isSelf ? <span className="text-[10.5px] faint">(you)</span> : null}</div>
                      </td>
                      <td className="faint">{item.email}</td>
                      <td>
                        <select
                          className="input input-mini"
                          value={item.role}
                          disabled={isSelf}
                          onChange={(event) => changeRole(item, event.target.value)}
                          title={isSelf ? 'You cannot change your own role' : 'Change role'}
                        >
                          {ROLES.map((role) => <option key={role.value} value={role.value}>{role.value}</option>)}
                        </select>
                      </td>
                      <td>
                        <Badge tone={item.isActive ? 'green' : 'red'}>{item.isActive ? 'Active' : 'Disabled'}</Badge>
                      </td>
                      <td className="faint">{new Date(item.createdAt).toLocaleDateString('en-GB')}</td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <button type="button" className="icon-btn" onClick={() => { setResetting(item); setNewPassword('') }} aria-label={`Reset password for ${item.name}`}><KeyRound size={14} /></button>
                          <button type="button" className="btn btn-sm" disabled={isSelf} onClick={() => toggleActive(item)}>
                            {item.isActive ? 'Disable' : 'Enable'}
                          </button>
                          <button type="button" className="icon-btn" style={{ color: 'var(--red)' }} disabled={isSelf} onClick={() => remove(item)} aria-label={`Delete ${item.name}`}><Trash2 size={14} /></button>
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
        <CardHeader title="Role permissions" subtitle="Enforced by the API on every request, not only in the interface" />
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

      {creating ? <UserForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load() }} notify={notify} /> : null}

      {resetting ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Reset password">
          <div className="modal">
            <div className="modal-head">
              <h3>Reset password</h3>
              <button type="button" className="btn btn-sm" onClick={() => setResetting(null)}>Close</button>
            </div>
            <div className="modal-body">
              <p className="text-[12px] muted">Set a new password for <strong>{resetting.name}</strong>. Share it securely and ask them to change it.</p>
              <label className="field mt-3">
                <span className="field-label">New password</span>
                <input className="input" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
              </label>
              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setResetting(null)}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={resetPassword} disabled={newPassword.length < 8}>Update password</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

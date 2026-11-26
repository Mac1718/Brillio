import { useCallback, useEffect, useState } from 'react'
import { ArrowDownUp, Boxes, CalendarClock, Download, Pencil, Plus, Search, ShieldAlert, Trash2, UploadCloud } from 'lucide-react'
import { Badge, Card, CardHeader, EmptyState, KpiCard, PageHeader } from '../components/ui'
import SamImportPanel from '../components/SamImportPanel'
import { api, toQueryString } from '../lib/api'
import { useAuth } from '../auth/AuthContext'

const EMPTY = {
  name: '',
  vendorName: '',
  softwareStatus: 'Active',
  purchasedDate: '',
  expiryDate: '',
}

const STATUSES = ['Active', 'Inactive', 'Suspended', 'Retired']

const EXPIRY_META = {
  active: { tone: 'green', label: 'Active' },
  expiring60: { tone: 'amber', label: 'Expiring soon' },
  expiring30: { tone: 'amber', label: 'Expiring within 30 days' },
  expired: { tone: 'red', label: 'Expired' },
  unknown: { tone: 'neutral', label: 'No expire date' },
}

const SORTS = [
  { value: 'expiry-asc', label: 'Expire date · soonest first' },
  { value: 'expiry-desc', label: 'Expire date · latest first' },
  { value: 'purchase-desc', label: 'Purchase date · newest first' },
  { value: 'purchase-asc', label: 'Purchase date · oldest first' },
  { value: 'name-asc', label: 'Software name · A to Z' },
]

const filled = (record) =>
  Object.fromEntries(
    Object.keys(EMPTY).map((key) => {
      const value = record?.[key]
      return [key, value == null ? '' : String(value)]
    }),
  )

const daysLabel = (days) => {
  if (days == null) return '—'
  if (days === 0) return 'Expires today'
  if (days > 0) return `${days} day${days === 1 ? '' : 's'} left`
  return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`
}

const downloadTemplate = async (notify) => {
  try {
    const response = await fetch('/api/software/template', { credentials: 'include' })
    if (!response.ok) throw new Error('Could not download the SAM template')
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'SAM-Software-Template.xlsx'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  } catch (error) {
    notify?.(error.message)
  }
}

function SoftwareForm({ initial, statuses, onClose, onSaved, notify }) {
  const [form, setForm] = useState(filled(initial))
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const isEdit = Boolean(initial?.id)

  const set = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
    setFormError('')
  }

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setFormError('')
    try {
      if (isEdit) await api.patch(`/software/${initial.id}`, form)
      else await api.post('/software', form)
      notify?.(isEdit ? 'Software record updated' : 'Software record added')
      onSaved()
    } catch (error) {
      if (error.fields) setErrors(error.fields)
      setFormError(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit software' : 'Add software'}>
      <div className="modal">
        <div className="modal-head">
          <div>
            <h3>{isEdit ? 'Edit Software Record' : 'Add Software Record'}</h3>
            <p className="text-[11.5px] faint">Software name, purchase date and expire date are required.</p>
          </div>
          <button type="button" className="btn btn-sm" onClick={onClose}>Close</button>
        </div>

        <form onSubmit={submit} className="modal-body" noValidate>
          <div className="form-grid">
            <label className="field span-2">
              <span className="field-label">Software name *</span>
              <input className="input" value={form.name} onChange={set('name')} placeholder="Microsoft 365 Business" />
              {errors.name ? <span className="field-error">{errors.name}</span> : null}
            </label>
            <label className="field">
              <span className="field-label">Software vendor</span>
              <input className="input" value={form.vendorName} onChange={set('vendorName')} placeholder="Microsoft" />
            </label>
            <label className="field">
              <span className="field-label">Software status</span>
              <input className="input" list="sam-statuses" value={form.softwareStatus} onChange={set('softwareStatus')} placeholder="Active" />
              <datalist id="sam-statuses">
                {statuses.map((status) => <option key={status} value={status} />)}
              </datalist>
            </label>
            <label className="field">
              <span className="field-label">Purchase date *</span>
              <input className="input" type="date" value={form.purchasedDate} onChange={set('purchasedDate')} />
              {errors.purchasedDate ? <span className="field-error">{errors.purchasedDate}</span> : null}
            </label>
            <label className="field">
              <span className="field-label">Expire date *</span>
              <input className="input" type="date" value={form.expiryDate} onChange={set('expiryDate')} />
              {errors.expiryDate ? <span className="field-error">{errors.expiryDate}</span> : null}
            </label>
          </div>

          {formError ? <div className="auth-error">{formError}</div> : null}

          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Add software'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Sam({ notify, refreshKey = 0 }) {
  const { isAdmin } = useAuth()
  const [items, setItems] = useState([])
  const [summary, setSummary] = useState({ total: 0, active: 0, expired: 0, expiring30: 0 })
  const [statuses, setStatuses] = useState(STATUSES)
  const [filters, setFilters] = useState({ search: '', softwareStatus: '', sort: 'expiry-asc' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.get(`/software${toQueryString(filters)}`)
      setItems(data.items)
      setSummary(data.summary)
      setStatuses(data.filters?.statuses?.length ? data.filters.statuses : STATUSES)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    const timer = setTimeout(load, 180)
    return () => clearTimeout(timer)
  }, [load, refreshKey])

  const update = (key) => (event) => setFilters((prev) => ({ ...prev, [key]: event.target.value }))

  const remove = async (item) => {
    if (!window.confirm(`Delete the software record “${item.name}”? This cannot be undone.`)) return
    try {
      await api.delete(`/software/${item.id}`)
      notify?.('Software record deleted')
      load()
    } catch (err) {
      notify?.(err.message)
    }
  }

  const hasFilters = Boolean(filters.search || filters.softwareStatus || filters.sort !== 'expiry-asc')

  return (
    <div className="fade-in">
      <PageHeader
        title="SAM – Software Asset Management"
        description="Software licences with expiry monitoring derived from each record's expire date. Statistics are calculated live from stored SAM records."
        actions={
          isAdmin ? (
            <>
              <button type="button" className="btn" onClick={() => downloadTemplate(notify)}>
                <Download size={15} /> Download Template
              </button>
              <button type="button" className="btn" onClick={() => setUploading(true)}>
                <UploadCloud size={15} /> Upload Excel
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setEditing({ ...EMPTY })}>
                <Plus size={15} /> Add Software
              </button>
            </>
          ) : null
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Software" value={summary.total} tone="brand" icon={Boxes} foot="All SAM records" />
        <KpiCard label="Active Software" value={summary.active} tone="green" icon={Boxes} foot="Expire date more than 30 days away" />
        <KpiCard label="Expired Software" value={summary.expired} tone="red" icon={ShieldAlert} foot={summary.expired ? 'Expire date has passed' : 'Nothing expired'} />
        <KpiCard label="Expiring Soon" value={summary.expiring30} tone="amber" icon={CalendarClock} foot="Expires today or within 30 days" />
      </div>

      <Card className="mb-4">
        <div className="filter-bar">
          <div className="input-group">
            <Search size={14} />
            <input className="input" placeholder="Search software name or vendor…" value={filters.search} onChange={update('search')} />
          </div>
          <select className="input input-auto" value={filters.softwareStatus} onChange={update('softwareStatus')}>
            <option value="">All statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <select className="input input-auto" value={filters.sort} onChange={update('sort')} aria-label="Sort records">
            {SORTS.map((sort) => <option key={sort.value} value={sort.value}>{sort.label}</option>)}
          </select>
          {hasFilters ? (
            <button type="button" className="btn btn-sm" onClick={() => setFilters({ search: '', softwareStatus: '', sort: 'expiry-asc' })}>
              Clear
            </button>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Software Records"
          subtitle={`${items.length} record${items.length === 1 ? '' : 's'} · expired in red, expiring within 30 days in amber, active in green`}
          action={<span className="flex items-center gap-1 text-[11px] faint"><ArrowDownUp size={12} /> Sorted as selected</span>}
        />

        {error ? <div className="p-4 text-[12.5px]" style={{ color: 'var(--red)' }}>{error}</div> : null}

        {!error && !loading && !items.length ? (
          <EmptyState
            icon={Boxes}
            title={hasFilters ? 'No software matches these filters' : 'No software records yet'}
            description={
              hasFilters
                ? 'Clear or widen the filters to see the full SAM register.'
                : isAdmin
                  ? 'Upload a SAM Excel workbook or add the first software record manually.'
                  : 'An administrator needs to upload or add software records before this module has data.'
            }
          />
        ) : null}

        {items.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Software Name</th>
                  <th>Software Vendor</th>
                  <th>Software Status</th>
                  <th>Purchase Date</th>
                  <th>Expire Date</th>
                  {isAdmin ? <th className="text-right">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const expiryMeta = EXPIRY_META[item.expiryState] || EXPIRY_META.unknown
                  const rowClass =
                    item.expiryState === 'expired'
                      ? 'sam-row-expired'
                      : item.expiryState === 'expiring30'
                        ? 'sam-row-expiring'
                        : item.expiryState === 'active'
                          ? 'sam-row-active'
                          : ''
                  return (
                    <tr key={item.id} className={rowClass}>
                      <td className="font-medium">
                        {item.name}
                        {item.source === 'excel' ? <span className="ml-1.5 text-[10px] faint">Excel</span> : null}
                      </td>
                      <td>{item.vendorName || '—'}</td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <span className={`sam-dot sam-dot-${expiryMeta.tone}`} aria-hidden="true" />
                          <span>{item.softwareStatus || '—'}</span>
                        </div>
                        {item.statusConflict ? (
                          <div className="mt-0.5 max-w-[240px] whitespace-normal text-[10.5px]" style={{ color: 'var(--amber)' }}>
                            {item.statusConflict}
                          </div>
                        ) : null}
                      </td>
                      <td className="mono">{item.purchasedDate || '—'}</td>
                      <td className="mono">
                        <div style={{ color: item.expiryState === 'expired' ? 'var(--red)' : item.expiryState === 'expiring30' ? 'var(--amber)' : undefined }}>
                          {item.expiryDate || '—'}
                        </div>
                        <div className="text-[10.5px] faint">{daysLabel(item.daysRemaining)}</div>
                      </td>
                      {isAdmin ? (
                        <td>
                          <div className="flex justify-end gap-1">
                            <button type="button" className="icon-btn" onClick={() => setEditing(item)} aria-label={`Edit ${item.name}`}><Pencil size={14} /></button>
                            <button type="button" className="icon-btn" style={{ color: 'var(--red)' }} onClick={() => remove(item)} aria-label={`Delete ${item.name}`}><Trash2 size={14} /></button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      {editing ? (
        <SoftwareForm
          initial={editing}
          statuses={statuses}
          notify={notify}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      ) : null}

      {uploading ? (
        <SamImportPanel
          notify={notify}
          onClose={() => setUploading(false)}
          onImported={() => {
            setUploading(false)
            load()
          }}
        />
      ) : null}
    </div>
  )
}

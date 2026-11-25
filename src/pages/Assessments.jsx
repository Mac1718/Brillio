import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Badge, Card, CardHeader, EmptyState, PageHeader } from '../components/ui'
import { api, toQueryString } from '../lib/api'
import { useAuth } from '../auth/AuthContext'
import { assessmentBadgeTone } from '../lib/records'
import { QUARTERS } from '../lib/quarters'

const STATUSES = ['Pending', 'In Progress', 'Completed', 'Cancelled']

const EMPTY_FORM = {
  assetId: '',
  serial: '',
  name: '',
  category: '',
  brand: '',
  model: '',
  quantity: 1,
  employee: '',
  department: '',
  location: '',
  assetStatus: '',
  purchaseDate: '',
  price: '',
  currentValue: '',
  warrantyStart: '',
  warrantyEnd: '',
  storage: '',
  storageType: '',
  ram: '',
  processor: '',
  os: '',
  vendorName: '',
  assessmentDate: '',
  assessmentStatus: 'Pending',
  notes: '',
}

const fromRecord = (record) => ({
  ...EMPTY_FORM,
  assetId: record.assetId || '',
  serial: record.serial || '',
  name: record.name || '',
  category: record.category || '',
  brand: record.brand || '',
  model: record.model || '',
  quantity: record.quantity ?? 1,
  employee: record.employee || '',
  department: record.department || '',
  location: record.location || '',
  assetStatus: record.assetStatus || '',
  purchaseDate: record.purchaseDate || '',
  price: record.price ?? '',
  currentValue: record.currentValue ?? '',
  warrantyStart: record.warrantyStart || '',
  warrantyEnd: record.warrantyEnd || '',
  storage: record.storage || '',
  storageType: record.storageType || '',
  ram: record.ram || '',
  processor: record.processor || '',
  os: record.os || '',
  vendorName: record.vendorName || '',
  assessmentDate: record.assessmentDate || '',
  assessmentStatus: record.assessmentStatus || 'Pending',
  notes: record.notes || '',
})

function AssessmentForm({ initial, vendors, onClose, onSaved, notify }) {
  const [form, setForm] = useState(initial?.id ? fromRecord(initial) : { ...EMPTY_FORM, ...initial })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const isEdit = Boolean(initial?.id)

  const set = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
    setError('')
  }

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (isEdit) await api.patch(`/assessments/${initial.id}`, form)
      else await api.post('/assessments', form)
      notify?.(isEdit ? 'Assessment updated' : 'Assessment recorded')
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit assessment' : 'New assessment'}>
      <div className="modal modal-lg">
        <div className="modal-head">
          <div>
            <h3>{isEdit ? 'Edit assessment' : 'New assessment'}</h3>
            <p className="text-[11.5px] faint">The year and quarter are derived from the assessment date, never from the upload date.</p>
          </div>
          <button type="button" className="btn btn-sm" onClick={onClose}>Close</button>
        </div>

        <form onSubmit={submit} className="modal-body" noValidate>
          <div className="form-grid">
            <label className="field">
              <span className="field-label">Asset ID *</span>
              <input className="input" value={form.assetId} onChange={set('assetId')} placeholder="IT-1001" />
            </label>
            <label className="field">
              <span className="field-label">Serial number</span>
              <input className="input" value={form.serial} onChange={set('serial')} />
            </label>
            <label className="field">
              <span className="field-label">Assessment date *</span>
              <input className="input" type="date" value={form.assessmentDate} onChange={set('assessmentDate')} />
            </label>
            <label className="field">
              <span className="field-label">Assessment status</span>
              <select className="input" value={form.assessmentStatus} onChange={set('assessmentStatus')}>
                {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>

            <label className="field span-2">
              <span className="field-label">Asset name</span>
              <input className="input" value={form.name} onChange={set('name')} placeholder="Dell OptiPlex 7010" />
            </label>
            <label className="field">
              <span className="field-label">Category</span>
              <input className="input" value={form.category} onChange={set('category')} placeholder="Desktop" />
            </label>
            <label className="field">
              <span className="field-label">Quantity</span>
              <input className="input" type="number" min="1" value={form.quantity} onChange={set('quantity')} />
            </label>
            <label className="field">
              <span className="field-label">Brand</span>
              <input className="input" value={form.brand} onChange={set('brand')} />
            </label>
            <label className="field">
              <span className="field-label">Model</span>
              <input className="input" value={form.model} onChange={set('model')} />
            </label>
            <label className="field">
              <span className="field-label">Assigned to</span>
              <input className="input" value={form.employee} onChange={set('employee')} />
            </label>
            <label className="field">
              <span className="field-label">Department</span>
              <input className="input" value={form.department} onChange={set('department')} />
            </label>
            <label className="field">
              <span className="field-label">Location</span>
              <input className="input" value={form.location} onChange={set('location')} />
            </label>
            <label className="field">
              <span className="field-label">Asset status</span>
              <input className="input" value={form.assetStatus} onChange={set('assetStatus')} placeholder="Assigned, Available…" />
            </label>
            <label className="field">
              <span className="field-label">Vendor</span>
              <select className="input" value={form.vendorName} onChange={set('vendorName')}>
                <option value="">Not linked</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.name}>{vendor.name}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field-label">Purchase date</span>
              <input className="input" type="date" value={form.purchaseDate} onChange={set('purchaseDate')} />
            </label>
            <label className="field">
              <span className="field-label">Purchase price</span>
              <input className="input" type="number" step="0.01" value={form.price} onChange={set('price')} />
            </label>
            <label className="field">
              <span className="field-label">Current value</span>
              <input className="input" type="number" step="0.01" value={form.currentValue} onChange={set('currentValue')} />
            </label>
            <label className="field">
              <span className="field-label">Warranty start</span>
              <input className="input" type="date" value={form.warrantyStart} onChange={set('warrantyStart')} />
            </label>
            <label className="field">
              <span className="field-label">Warranty expiry</span>
              <input className="input" type="date" value={form.warrantyEnd} onChange={set('warrantyEnd')} />
            </label>
            <label className="field">
              <span className="field-label">Storage</span>
              <input className="input" value={form.storage} onChange={set('storage')} placeholder="512 GB SSD" />
            </label>
            <label className="field">
              <span className="field-label">Storage type</span>
              <input className="input" value={form.storageType} onChange={set('storageType')} placeholder="SSD" />
            </label>
            <label className="field">
              <span className="field-label">RAM</span>
              <input className="input" value={form.ram} onChange={set('ram')} placeholder="16 GB" />
            </label>
            <label className="field">
              <span className="field-label">Processor</span>
              <input className="input" value={form.processor} onChange={set('processor')} />
            </label>
            <label className="field">
              <span className="field-label">Operating system</span>
              <input className="input" value={form.os} onChange={set('os')} />
            </label>
            <label className="field span-2">
              <span className="field-label">Notes</span>
              <textarea className="input textarea" rows={2} value={form.notes} onChange={set('notes')} />
            </label>
          </div>

          {error ? <div className="auth-error">{error}</div> : null}

          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : isEdit ? 'Save changes' : 'Save assessment'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Assessments({ notify, refreshKey = 0, onChanged }) {
  const { isAdmin } = useAuth()
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ year: '', quarter: '', status: '', vendorId: '', city: '' })
  const [meta, setMeta] = useState({ vendors: [], cities: [], years: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)

  const loadMeta = useCallback(async () => {
    try {
      const data = await api.get('/assessments/filters')
      setMeta(data)
    } catch {
      /* filters stay empty */
    }
  }, [])

  useEffect(() => {
    loadMeta()
  }, [loadMeta, refreshKey])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const query = toQueryString({ ...filters, search, page, pageSize })
      const data = await api.get(`/assessments${query}`)
      setItems(data.items)
      setTotal(data.total)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [filters, search, page, pageSize])

  useEffect(() => {
    const timer = setTimeout(load, 200)
    return () => clearTimeout(timer)
  }, [load, refreshKey])

  const updateFilter = (key) => (event) => {
    setPage(1)
    setFilters((prev) => ({ ...prev, [key]: event.target.value }))
  }

  const remove = async (record) => {
    if (!window.confirm(`Delete the assessment for ${record.assetId || record.serial} on ${record.assessmentDate}?`)) return
    try {
      await api.delete(`/assessments/${record.id}`)
      notify?.('Assessment deleted')
      load()
      if (onChanged) onChanged()
    } catch (err) {
      notify?.(err.message)
    }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize))
  const hasFilters = search || Object.values(filters).some(Boolean)

  const yearOptions = useMemo(() => meta.years || [], [meta.years])

  return (
    <div className="fade-in">
      <PageHeader
        title="Assessment records"
        description="Every record with its assessment date, derived year and quarter. Admins can add, edit and delete; managers and staff see the same data read-only."
        actions={
          isAdmin ? (
            <button type="button" className="btn btn-primary" onClick={() => setEditing({ ...EMPTY_FORM })}>
              <Plus size={15} /> New assessment
            </button>
          ) : null
        }
      />

      <Card className="mb-4">
        <div className="filter-bar">
          <div className="input-group">
            <Search size={14} />
            <input className="input" placeholder="Search asset, serial, employee, vendor…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} />
          </div>
          <select className="input input-auto" value={filters.year} onChange={updateFilter('year')}>
            <option value="">All years</option>
            {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
          <select className="input input-auto" value={filters.quarter} onChange={updateFilter('quarter')}>
            <option value="">All quarters</option>
            {QUARTERS.map((quarter) => <option key={quarter} value={quarter}>{quarter}</option>)}
          </select>
          <select className="input input-auto" value={filters.status} onChange={updateFilter('status')}>
            <option value="">All statuses</option>
            {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <select className="input input-auto" value={filters.vendorId} onChange={updateFilter('vendorId')}>
            <option value="">All vendors</option>
            {meta.vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
          </select>
          <select className="input input-auto" value={filters.city} onChange={updateFilter('city')}>
            <option value="">All cities</option>
            {meta.cities.map((city) => <option key={city} value={city}>{city}</option>)}
          </select>
          {hasFilters ? (
            <button type="button" className="btn btn-sm" onClick={() => { setSearch(''); setFilters({ year: '', quarter: '', status: '', vendorId: '', city: '' }); setPage(1) }}>
              Clear
            </button>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader title="Records" subtitle={`${total} matching record${total === 1 ? '' : 's'}`} />

        {error ? <div className="p-4 text-[12.5px]" style={{ color: 'var(--red)' }}>{error}</div> : null}

        {!error && !loading && !items.length ? (
          <EmptyState
            icon={ClipboardList}
            title={hasFilters ? 'No records match these filters' : 'No assessment records yet'}
            description={hasFilters ? 'Adjust the filters or clear them to see all records.' : 'Import an Excel register with an Assessment Date column, or add the first record manually.'}
          />
        ) : null}

        {items.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Vendor</th>
                  <th>Assessment date</th>
                  <th>Year</th>
                  <th>Quarter</th>
                  <th>Status</th>
                  <th>Source</th>
                  {isAdmin ? <th className="text-right">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {items.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <div className="font-medium">{record.assetId || record.serial || '—'}</div>
                      <div className="text-[11.5px] faint">
                        {[record.name || record.category, record.department, record.location].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </td>
                    <td>
                      <div>{record.vendorName || '—'}</div>
                      <div className="text-[11.5px] faint">{record.vendorCity || ''}</div>
                    </td>
                    <td className="mono">
                      <span className="inline-flex items-center gap-1.5"><CalendarDays size={12} /> {record.assessmentDate || '—'}</span>
                    </td>
                    <td className="mono">{record.assessmentYear ?? '—'}</td>
                    <td><Badge tone="neutral">{record.assessmentQuarter || '—'}</Badge></td>
                    <td><Badge tone={assessmentBadgeTone(record.assessmentStatus)}>{record.assessmentStatus}</Badge></td>
                    <td className="text-[11.5px] faint">{record.source === 'excel' ? 'Excel' : 'Manual'}</td>
                    {isAdmin ? (
                      <td>
                        <div className="flex justify-end gap-1">
                          <button type="button" className="icon-btn" onClick={() => setEditing(record)} aria-label="Edit assessment"><Pencil size={14} /></button>
                          <button type="button" className="icon-btn" style={{ color: 'var(--red)' }} onClick={() => remove(record)} aria-label="Delete assessment"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="table-footer">
          <div className="flex items-center gap-2 text-[11.5px] faint">
            <span>Rows per page</span>
            <select className="input input-mini" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }}>
              {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="icon-btn" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1} aria-label="Previous page"><ChevronLeft size={15} /></button>
            <span className="text-[11.5px] muted">Page {page} of {pages}</span>
            <button type="button" className="icon-btn" onClick={() => setPage((value) => Math.min(pages, value + 1))} disabled={page >= pages} aria-label="Next page"><ChevronRight size={15} /></button>
          </div>
        </div>
      </Card>

      {editing ? (
        <AssessmentForm
          initial={editing}
          vendors={meta.vendors}
          notify={notify}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
            loadMeta()
            if (onChanged) onChanged()
          }}
        />
      ) : null}
    </div>
  )
}

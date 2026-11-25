import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, Mail, MapPin, Pencil, Phone, Plus, Search, Trash2, User } from 'lucide-react'
import IndiaMap from '../components/IndiaMap'
import { Badge, Card, CardHeader, EmptyState, PageHeader } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../auth/AuthContext'

const EMPTY_FORM = {
  name: '',
  city: '',
  state: '',
  address: '',
  contactPerson: '',
  email: '',
  phone: '',
  category: '',
  notes: '',
}

const filled = (values) =>
  Object.fromEntries(Object.keys(EMPTY_FORM).map((key) => [key, values?.[key] == null ? '' : String(values[key])]))

function VendorForm({ initial, onClose, onSaved, notify }) {
  const [form, setForm] = useState(filled(initial))
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const isEdit = Boolean(initial?.id)

  const set = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setFormError('')
    try {
      if (isEdit) await api.patch(`/vendors/${initial.id}`, form)
      else await api.post('/vendors', form)
      notify?.(isEdit ? 'Vendor updated' : 'Vendor added')
      onSaved()
    } catch (error) {
      if (error.fields) setErrors(error.fields)
      setFormError(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit vendor' : 'Add vendor'}>
      <div className="modal">
        <div className="modal-head">
          <h3>{isEdit ? 'Edit vendor' : 'Add vendor'}</h3>
          <button type="button" className="btn btn-sm" onClick={onClose}>Close</button>
        </div>
        <form onSubmit={submit} className="modal-body" noValidate>
          <div className="form-grid">
            <label className="field span-2">
              <span className="field-label">Vendor name *</span>
              <input className="input" value={form.name} onChange={set('name')} placeholder="Chennai Systems Pvt Ltd" />
              {errors.name ? <span className="field-error">{errors.name}</span> : null}
            </label>
            <label className="field">
              <span className="field-label">City *</span>
              <input className="input" value={form.city} onChange={set('city')} placeholder="Chennai" />
              {errors.city ? <span className="field-error">{errors.city}</span> : null}
            </label>
            <label className="field">
              <span className="field-label">State *</span>
              <input className="input" value={form.state} onChange={set('state')} placeholder="Tamil Nadu" />
              {errors.state ? <span className="field-error">{errors.state}</span> : null}
            </label>
            <label className="field span-2">
              <span className="field-label">Address</span>
              <input className="input" value={form.address} onChange={set('address')} placeholder="Street, area, PIN" />
            </label>
            <label className="field">
              <span className="field-label">Contact person</span>
              <input className="input" value={form.contactPerson} onChange={set('contactPerson')} />
            </label>
            <label className="field">
              <span className="field-label">Category</span>
              <input className="input" value={form.category} onChange={set('category')} placeholder="Hardware, AMC, Services" />
            </label>
            <label className="field">
              <span className="field-label">Email</span>
              <input className="input" type="email" value={form.email} onChange={set('email')} />
              {errors.email ? <span className="field-error">{errors.email}</span> : null}
            </label>
            <label className="field">
              <span className="field-label">Phone</span>
              <input className="input" value={form.phone} onChange={set('phone')} />
            </label>
            <label className="field span-2">
              <span className="field-label">Notes</span>
              <textarea className="input textarea" rows={3} value={form.notes} onChange={set('notes')} />
            </label>
          </div>

          {formError ? <div className="auth-error">{formError}</div> : null}

          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Add vendor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Vendors({ notify }) {
  const { isAdmin } = useAuth()
  const [items, setItems] = useState([])
  const [cities, setCities] = useState([])
  const [search, setSearch] = useState('')
  const [selectedCity, setSelectedCity] = useState(null)
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (selectedCity) params.set('city', selectedCity)
      const data = await api.get(`/vendors${params.toString() ? `?${params}` : ''}`)
      setItems(data.items)
      setCities(data.cities)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [search, selectedCity])

  useEffect(() => {
    const timer = setTimeout(load, 220)
    return () => clearTimeout(timer)
  }, [load])

  const remove = async (vendor) => {
    if (!window.confirm(`Delete ${vendor.name} in ${vendor.city}? Existing assessments keep the vendor name but lose the link.`)) return
    try {
      const result = await api.delete(`/vendors/${vendor.id}`)
      notify?.(`Vendor deleted${result.detachedAssessments ? ` · ${result.detachedAssessments} assessments detached` : ''}`)
      load()
    } catch (err) {
      notify?.(err.message)
    }
  }

  const cityVendors = useMemo(
    () => (selectedCity ? items.filter((vendor) => vendor.city.toLowerCase() === selectedCity.toLowerCase()) : []),
    [items, selectedCity],
  )

  const totalVendors = cities.reduce((total, city) => total + city.vendorCount, 0)

  return (
    <div className="fade-in">
      <PageHeader
        title="Vendors"
        description="Vendor locations across India. Select a city on the map to see every vendor based there."
        actions={
          isAdmin ? (
            <button type="button" className="btn btn-primary" onClick={() => setEditing({ ...EMPTY_FORM })}>
              <Plus size={15} /> Add vendor
            </button>
          ) : null
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Vendors', value: totalVendors },
          { label: 'Cities covered', value: cities.length },
          { label: 'Assessments linked', value: cities.reduce((total, city) => total + city.assessmentCount, 0) },
        ].map((stat) => (
          <div key={stat.label} className="card px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] faint">{stat.label}</div>
            <div className="mono mt-1 text-[19px] font-semibold tracking-[-0.02em]">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr] xl:items-start">
        <Card className="overflow-hidden">
          <CardHeader
            title="Vendor map of India"
            subtitle={selectedCity ? `Showing ${selectedCity} — select again to clear` : 'Click any city marker to filter vendors'}
            action={
              <button type="button" className="btn btn-sm" onClick={() => setSelectedCity(null)} disabled={!selectedCity}>
                Reset
              </button>
            }
          />
          <div className="p-3 sm:p-5">
            <IndiaMap cities={cities} selectedCity={selectedCity} onSelectCity={setSelectedCity} searchTerm={search} />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {cities.map((city) => (
                <button
                  key={`${city.city}-${city.state}`}
                  type="button"
                  className={`chip ${selectedCity === city.city ? 'on' : ''}`}
                  onClick={() => setSelectedCity(selectedCity === city.city ? null : city.city)}
                >
                  {city.city} · {city.vendorCount}
                </button>
              ))}
              {!cities.length && !loading ? <span className="text-[12px] faint">No vendor locations recorded yet.</span> : null}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title={selectedCity ? `Vendors in ${selectedCity}` : 'All vendors'}
            subtitle={`${items.length} record${items.length === 1 ? '' : 's'}`}
            action={
              <div className="input-group input-group-sm">
                <Search size={14} />
                <input className="input" placeholder="Search vendors" value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
            }
          />

          <div className="vendor-list">
            {error ? <div className="p-4 text-[12px]" style={{ color: 'var(--red)' }}>{error}</div> : null}
            {!loading && !items.length && !error ? (
              <EmptyState
                icon={Building2}
                title={search ? 'No matching vendors' : 'No vendors yet'}
                description={search ? 'Try a different name, city or contact.' : 'Administrators can add the first vendor, or import assessments that reference existing vendors.'}
              />
            ) : null}

            {selectedCity && !cityVendors.length && items.length ? (
              <div className="p-4 text-[12px] faint">No vendors in {selectedCity} match the current search.</div>
            ) : null}

            {items.map((vendor) => (
              <div key={vendor.id} className="vendor-row">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-semibold">{vendor.name}</span>
                    {vendor.category ? <Badge tone="neutral">{vendor.category}</Badge> : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] muted">
                    <span className="inline-flex items-center gap-1"><MapPin size={12} /> {vendor.city}, {vendor.state}</span>
                    {vendor.contactPerson ? <span className="inline-flex items-center gap-1"><User size={12} /> {vendor.contactPerson}</span> : null}
                    {vendor.phone ? <span className="inline-flex items-center gap-1"><Phone size={12} /> {vendor.phone}</span> : null}
                    {vendor.email ? <span className="inline-flex items-center gap-1"><Mail size={12} /> {vendor.email}</span> : null}
                  </div>
                  {vendor.address ? <div className="mt-1 text-[11.5px] faint">{vendor.address}</div> : null}
                </div>
                {isAdmin ? (
                  <div className="flex flex-none gap-1">
                    <button type="button" className="icon-btn" onClick={() => setEditing(vendor)} aria-label={`Edit ${vendor.name}`}>
                      <Pencil size={14} />
                    </button>
                    <button type="button" className="icon-btn" onClick={() => remove(vendor)} aria-label={`Delete ${vendor.name}`} style={{ color: 'var(--red)' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {editing ? (
        <VendorForm
          initial={editing}
          notify={notify}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      ) : null}
    </div>
  )
}

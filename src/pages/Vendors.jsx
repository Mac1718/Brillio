import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  User,
  X,
} from 'lucide-react'
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

const keyOf = (value) =>
  value?.key ||
  value?.location?.key ||
  `${String(value?.city || '').trim().toLowerCase()}||${String(value?.state || '').trim().toLowerCase()}`

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
      const result = isEdit ? await api.patch(`/vendors/${initial.id}`, form) : await api.post('/vendors', form)
      notify?.(isEdit ? 'Vendor updated' : 'Vendor added')
      onSaved?.(result?.item || null)
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
          <h3>{isEdit ? 'Edit Vendor' : 'Add Vendor'}</h3>
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
  const [unresolved, setUnresolved] = useState([])
  const [totals, setTotals] = useState(null)
  const [search, setSearch] = useState('')
  const [selectedCity, setSelectedCity] = useState(null)
  const [stateFilter, setStateFilter] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // The full master list is loaded once so the map and the city panel stay
      // in sync; filtering happens client-side.
      const data = await api.get('/vendors')
      setItems(data.items)
      setCities(data.cities || [])
      setUnresolved(data.unresolvedLocations || [])
      setTotals(data.totals || null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // New vendors created by an assessment import appear without a manual refresh.
  useEffect(() => {
    const refresh = () => load()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [load])

  const locatedKeys = useMemo(() => new Set(cities.map((city) => city.key)), [cities])

  // If the selected city no longer exists (last vendor moved or deleted), the
  // panel closes instead of showing an empty, stale location.
  useEffect(() => {
    if (!selectedCity) return
    const stillExists = cities.some((city) => city.key === keyOf(selectedCity))
    if (!stillExists && !loading) setSelectedCity(null)
  }, [cities, selectedCity, loading])

  const term = search.trim().toLowerCase()
  const matchesSearch = useCallback(
    (vendor) => {
      if (!term) return true
      return [
        vendor.name,
        vendor.city,
        vendor.state,
        vendor.location?.city,
        vendor.location?.state,
        vendor.contactPerson,
        vendor.category,
        vendor.email,
        vendor.phone,
      ].some((value) => String(value || '').toLowerCase().includes(term))
    },
    [term],
  )

  // Searching a city or a vendor narrows to one city: select it so the map
  // highlights and zooms there, then show that city's vendor list.
  useEffect(() => {
    if (!term || loading) return
    const cityKeys = new Set(
      items.filter((vendor) => vendor.location && matchesSearch(vendor)).map((vendor) => vendor.location.key),
    )
    if (cityKeys.size !== 1) return
    const [onlyKey] = cityKeys
    if (!locatedKeys.has(onlyKey)) return
    const vendor = items.find((entry) => entry.location?.key === onlyKey)
    if (!vendor) return
    setSelectedCity((current) =>
      current && keyOf(current) === onlyKey
        ? current
        : { key: onlyKey, city: vendor.location.city, state: vendor.location.state },
    )
  }, [term, items, locatedKeys, loading, matchesSearch])

  const remove = async (vendor) => {
    const where = vendor.hasLocation ? ` in ${vendor.city}` : ''
    if (!window.confirm(`Delete ${vendor.name}${where}? Existing assessments keep the vendor name but lose the link.`)) return
    try {
      const result = await api.delete(`/vendors/${vendor.id}`)
      notify?.(`Vendor deleted${result.detachedAssessments ? ` · ${result.detachedAssessments} assessments detached` : ''}`)
      if (expandedId === vendor.id) setExpandedId(null)
      load()
    } catch (err) {
      notify?.(err.message)
    }
  }

  const selectedKey = selectedCity ? keyOf(selectedCity) : null
  const cityVendors = useMemo(
    () => (selectedKey ? items.filter((vendor) => vendor.location?.key === selectedKey) : []),
    [items, selectedKey],
  )
  // Searching the selected city or state shows that city's full vendor list;
  // searching a vendor name filters within it.
  const cityTextMatch = useMemo(() => {
    if (!selectedCity || !term) return false
    return `${selectedCity.city} ${selectedCity.state}`.toLowerCase().includes(term)
  }, [selectedCity, term])
  const visibleVendors = useMemo(() => {
    const base = selectedKey ? cityVendors : items
    return cityTextMatch ? base : base.filter(matchesSearch)
  }, [selectedKey, cityVendors, items, matchesSearch, cityTextMatch])

  const withoutLocation = useMemo(() => items.filter((vendor) => !vendor.hasLocation), [items])
  const unresolvedVendors = useMemo(
    () => items.filter((vendor) => vendor.hasLocation && !vendor.location),
    [items],
  )
  const unmappedCount = withoutLocation.length + unresolvedVendors.length

  const totalVendors = totals?.vendors ?? items.length
  const selectedCount = selectedKey ? cityVendors.length : 0

  const handleSaved = (vendor) => {
    setEditing(null)
    load()
    const location = vendor?.location
    if (location) setSelectedCity({ key: location.key, city: location.city, state: location.state })
  }

  const unmappedEntries = useMemo(
    () => [
      ...withoutLocation.map((vendor) => ({ name: vendor.name, city: '', state: '', reason: 'No city and state recorded' })),
      ...unresolvedVendors.map((vendor) => ({
        name: vendor.name,
        city: vendor.city,
        state: vendor.state,
        reason: 'City could not be resolved to coordinates',
      })),
    ],
    [withoutLocation, unresolvedVendors],
  )

  return (
    <div className="fade-in">
      <PageHeader
        title="Vendors"
        description="Every vendor city in the master list is resolved to its own location on the map. Select a city to see all vendors registered there."
        actions={
          isAdmin ? (
            <button type="button" className="btn btn-primary" onClick={() => setEditing({ ...EMPTY_FORM })}>
              <Plus size={15} /> Add vendor
            </button>
          ) : null
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Vendors', value: totalVendors },
          { label: 'Cities covered', value: totals?.cities ?? cities.length },
          { label: 'Assessments linked', value: totals?.assessments ?? cities.reduce((total, city) => total + city.assessmentCount, 0) },
          { label: 'Unmapped locations', value: unmappedCount },
        ].map((stat) => (
          <div key={stat.label} className="card px-4 py-3">
            <div className="text-[11.5px] font-medium uppercase tracking-[0.05em] faint">{stat.label}</div>
            <div className="mono mt-1 text-[19px] font-semibold tracking-[-0.02em]">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr] xl:items-start">
        <Card className="overflow-hidden">
          <CardHeader
            title="Vendor Map of India"
            subtitle={
              selectedCity
                ? `Showing ${selectedCity.city}, ${selectedCity.state} — select again to clear`
                : 'Every city in the vendor master list is placed automatically'
            }
            action={
              <button type="button" className="btn btn-sm" onClick={() => setSelectedCity(null)} disabled={!selectedCity}>
                Reset
              </button>
            }
          />
          <div className="p-3 sm:p-5">
            <IndiaMap
              cities={cities}
              unmapped={unmappedEntries}
              selectedCity={selectedCity}
              onSelectCity={setSelectedCity}
              searchTerm={search}
              onSearchChange={setSearch}
              stateFilter={stateFilter}
              onStateFilter={setStateFilter}
            />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {cities.map((city) => {
                const active = selectedKey === city.key
                return (
                  <button
                    key={city.key}
                    type="button"
                    className={`chip ${active ? 'on' : ''}`}
                    onClick={() => setSelectedCity(active ? null : { key: city.key, city: city.city, state: city.state })}
                  >
                    {city.city} · {city.vendorCount}
                  </button>
                )
              })}
              {!cities.length && !loading ? (
                <span className="text-[12px] faint">No vendor locations recorded yet.</span>
              ) : null}
            </div>

            {unmappedEntries.length ? (
              <div className="unmapped-vendors">
                <div className="unmapped-vendors-head">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={13} /> Unmapped locations
                  </span>
                  <span className="mono faint">{unmappedEntries.length}</span>
                </div>
                <p className="unmapped-vendors-note">
                  These vendors cannot be placed on the map yet. Add a city and state, or correct a city that could not be
                  located, and the marker appears automatically.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {unmappedEntries.map((entry) => {
                    const vendor = items.find((item) => item.name === entry.name)
                    return (
                      <button
                        key={`${entry.name}-${entry.city}`}
                        type="button"
                        className="chip"
                        onClick={() => (isAdmin && vendor ? setEditing(vendor) : null)}
                        title={entry.reason}
                      >
                        {entry.name}
                        {entry.city ? ` · ${entry.city}` : ''}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHeader
            title={selectedCity ? `Vendors in ${selectedCity.city}` : 'All Vendors'}
            subtitle={
              selectedCity
                ? `${selectedCity.city}, ${selectedCity.state} · ${selectedCount} vendor${selectedCount === 1 ? '' : 's'}`
                : `${items.length} record${items.length === 1 ? '' : 's'}`
            }
            action={
              <div className="flex items-center gap-2">
                <div className="input-group input-group-sm">
                  <Search size={14} />
                  <input className="input" placeholder="Search vendors" value={search} onChange={(event) => setSearch(event.target.value)} />
                </div>
                {selectedCity ? (
                  <button type="button" className="icon-btn" onClick={() => setSelectedCity(null)} aria-label="Close city panel">
                    <X size={14} />
                  </button>
                ) : null}
              </div>
            }
          />

          {selectedCity ? (
            <div className="city-panel-summary">
              <div>
                <div className="city-panel-label">Selected city</div>
                <div className="city-panel-name">{selectedCity.city}, {selectedCity.state}</div>
              </div>
              <div className="city-panel-stats">
                <div>
                  <span>Total vendors</span>
                  <strong>{selectedCount}</strong>
                </div>
                <div>
                  <span>Assessments</span>
                  <strong>{cities.find((city) => city.key === selectedKey)?.assessmentCount || 0}</strong>
                </div>
              </div>
            </div>
          ) : null}

          <div className="vendor-list">
            {error ? <div className="p-4 text-[12px]" style={{ color: 'var(--red)' }}>{error}</div> : null}
            {!loading && !visibleVendors.length && !error ? (
              <EmptyState
                icon={Building2}
                title={search ? 'No matching vendors' : selectedCity ? 'No vendors in this city' : 'No vendors yet'}
                description={
                  search
                    ? 'Try a different name, city, state or contact.'
                    : 'Administrators can add the first vendor, or import assessments that reference existing vendors.'
                }
              />
            ) : null}

            {visibleVendors.map((vendor) => {
              const expanded = expandedId === vendor.id
              const located = Boolean(vendor.location)
              return (
                <div key={vendor.id} className={`vendor-row ${expanded ? 'is-expanded' : ''}`}>
                  <button
                    type="button"
                    className="vendor-row-main"
                    onClick={() => setExpandedId(expanded ? null : vendor.id)}
                    aria-expanded={expanded}
                  >
                    <div className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-semibold">{vendor.name}</span>
                        {vendor.category ? <Badge tone="neutral">{vendor.category}</Badge> : null}
                        {vendor.hasLocation && !located ? <Badge tone="amber">Location unresolved</Badge> : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] muted">
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={12} />
                          {vendor.hasLocation ? `${vendor.city}, ${vendor.state}` : <span className="faint">Location not provided</span>}
                        </span>
                        {vendor.contactPerson ? <span className="inline-flex items-center gap-1"><User size={12} /> {vendor.contactPerson}</span> : null}
                        {vendor.phone ? <span className="inline-flex items-center gap-1"><Phone size={12} /> {vendor.phone}</span> : null}
                        {vendor.email ? <span className="inline-flex items-center gap-1"><Mail size={12} /> {vendor.email}</span> : null}
                      </div>
                      {vendor.address ? <div className="mt-1 text-[11.5px] faint">{vendor.address}</div> : null}
                    </div>
                    <span className="flex-none faint" aria-hidden="true">
                      {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </span>
                  </button>

                  {expanded ? (
                    <div className="vendor-detail-grid">
                      <div><span>Vendor</span><strong>{vendor.name}</strong></div>
                      <div><span>Category</span><strong>{vendor.category || '—'}</strong></div>
                      <div><span>Contact person</span><strong>{vendor.contactPerson || '—'}</strong></div>
                      <div><span>Email</span><strong>{vendor.email || '—'}</strong></div>
                      <div><span>Phone</span><strong>{vendor.phone || '—'}</strong></div>
                      <div><span>Address</span><strong>{vendor.address || '—'}</strong></div>
                      <div><span>City / State</span><strong>{vendor.hasLocation ? `${vendor.city}, ${vendor.state}` : 'Not provided'}</strong></div>
                      <div><span>Notes</span><strong>{vendor.notes || '—'}</strong></div>
                    </div>
                  ) : null}

                  {isAdmin ? (
                    <div className="vendor-row-actions">
                      <button type="button" className="icon-btn" onClick={() => setEditing(vendor)} aria-label={`Edit ${vendor.name}`}>
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => remove(vendor)}
                        aria-label={`Delete ${vendor.name}`}
                        style={{ color: 'var(--red)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {editing ? (
        <VendorForm
          initial={editing}
          notify={notify}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  )
}

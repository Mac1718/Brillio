import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, Search, SlidersHorizontal, X } from 'lucide-react'
import { Badge } from './ui'
import { formatCurrency, formatDate } from '../lib/format'
import { warrantyState } from '../lib/normalize'
import { downloadAssets } from '../lib/exporter'
import { hasField, unitsOf } from '../lib/analytics'

const STATUS_TONE = { Available: 'green', Assigned: 'blue', Maintenance: 'amber', Damaged: 'red', Retired: 'neutral', Other: 'neutral' }
const WARRANTY_TONE = { active: 'green', expiring: 'amber', expired: 'red', unknown: 'neutral' }

const COLUMNS = [
  { key: 'name', label: 'Asset', sort: (a) => `${a.name}`.toLowerCase() },
  { key: 'category', label: 'Category', sort: (a) => `${a.category || ''}`.toLowerCase() },
  { key: 'brand', label: 'Brand / Model', sort: (a) => `${a.brand} ${a.model}`.toLowerCase() },
  { key: 'employee', label: 'Assigned To', sort: (a) => `${a.employee || ''}`.toLowerCase() },
  { key: 'department', label: 'Department', sort: (a) => `${a.department || ''}`.toLowerCase() },
  { key: 'status', label: 'Status', sort: (a) => a.status },
  { key: 'purchaseDate', label: 'Purchased', sort: (a) => (a.purchaseDate ? a.purchaseDate.getTime() : 0) },
  { key: 'price', label: 'Price', sort: (a) => a.price ?? -1, align: 'right' },
  { key: 'warrantyEnd', label: 'Warranty', sort: (a) => (a.warrantyEnd ? a.warrantyEnd.getTime() : 0) },
]

const unique = (assets, selector) =>
  [...new Set(assets.map(selector).filter((value) => value != null && value !== ''))].sort((a, b) => String(a).localeCompare(String(b)))

export default function InventoryTable({
  assets,
  dataset,
  settings,
  onSelect,
  notify,
  title = 'Asset inventory',
  subtitle,
  compact = false,
}) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [department, setDepartment] = useState('all')
  const [status, setStatus] = useState('all')
  const [brand, setBrand] = useState('all')
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(settings.pageSize || 10)
  const [showFilters, setShowFilters] = useState(!compact)
  const showQuantity = hasField(dataset, 'quantity')

  const categories = useMemo(() => unique(assets, (a) => a.category), [assets])
  const departments = useMemo(() => unique(assets, (a) => a.department), [assets])
  const brands = useMemo(() => unique(assets, (a) => a.brand), [assets])

  useEffect(() => {
    setPage(1)
  }, [search, category, department, status, brand, pageSize, assets])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const rows = assets.filter((asset) => {
      if (category !== 'all' && asset.category !== category) return false
      if (department !== 'all' && asset.department !== department) return false
      if (status !== 'all' && asset.status !== status) return false
      if (brand !== 'all' && asset.brand !== brand) return false
      if (!term) return true
      return [
        asset.assetId,
        asset.serial,
        asset.name,
        asset.category,
        asset.categoryRaw,
        asset.brand,
        asset.model,
        asset.employee,
        asset.department,
        asset.location,
        asset.status,
        asset.statusRaw,
        asset.processor,
        asset.os,
        asset.notes,
      ]
        .join(' ')
        .toLowerCase()
        .includes(term)
    })
    const column = COLUMNS.find((c) => c.key === sort.key)
    const sorted = [...rows]
    if (column) {
      sorted.sort((a, b) => {
        const av = column.sort(a)
        const bv = column.sort(b)
        if (typeof av === 'number' && typeof bv === 'number') return sort.dir === 'asc' ? av - bv : bv - av
        return sort.dir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
      })
    }
    return sorted
  }, [assets, search, category, department, status, brand, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const activeFilters = [category, department, status, brand].filter((value) => value !== 'all').length + (search ? 1 : 0)

  const toggleSort = (key) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  }

  const clearFilters = () => {
    setSearch('')
    setCategory('all')
    setDepartment('all')
    setStatus('all')
    setBrand('all')
  }

  const exportFiltered = () => {
    if (!filtered.length) return
    downloadAssets(filtered, `it-assets-filtered-${new Date().toISOString().slice(0, 10)}.xlsx`)
    notify?.(`Exported ${filtered.length} filtered assets`)
  }

  const filterDefs = [
    { value: category, set: setCategory, key: 'category', placeholder: 'All categories', options: categories },
    { value: department, set: setDepartment, key: 'department', placeholder: 'All departments', options: departments },
    { value: status, set: setStatus, key: 'status', placeholder: 'All statuses', options: ['Available', 'Assigned', 'Maintenance', 'Damaged', 'Retired', 'Other'].filter((s) => assets.some((a) => a.status === s)) },
    { value: brand, set: setBrand, key: 'brand', placeholder: 'All brands', options: brands },
  ]

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[14px] font-semibold">{title}</h3>
            <Badge>{filtered.length}</Badge>
          </div>
          <p className="mt-0.5 text-[11.5px] faint">
            {subtitle ||
              `${filtered.length} of ${assets.length} rows${
                showQuantity ? ` · ${filtered.reduce((count, asset) => count + unitsOf(asset), 0)} units` : ''
              }${activeFilters ? ' · filters active' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeFilters ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
              <X size={13} /> Clear
            </button>
          ) : null}
          <button type="button" className="btn btn-sm" onClick={() => setShowFilters((v) => !v)}>
            <SlidersHorizontal size={13} /> Filters
          </button>
          <button type="button" className="btn btn-sm" onClick={exportFiltered} disabled={!filtered.length}>
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      <div className="border-b px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
            <input
              className="input pl-9"
              placeholder="Search asset, serial, employee, model…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {showFilters
            ? filterDefs.map((filter) => {
                if (!filter.options.length) return null
                return (
                  <select key={filter.key} className="select w-auto min-w-[130px]" value={filter.value} onChange={(event) => filter.set(event.target.value)}>
                    <option value="all">{filter.placeholder}</option>
                    {filter.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )
              })
            : null}
        </div>
        {showFilters && !hasField(dataset, 'status') ? (
          <p className="mt-2 text-[11px] faint">Status was not found in the workbook, so status is inferred from the assigned employee.</p>
        ) : null}
      </div>

      <div className="table-wrap" style={{ maxHeight: compact ? 360 : undefined }}>
        <table className="data-table">
          <thead>
            <tr>
              {showQuantity ? <th>Qty</th> : null}
              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  className="sortable"
                  style={{ textAlign: column.align || 'left' }}
                  onClick={() => toggleSort(column.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {column.label}
                    {sort.key === column.key ? sort.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} /> : null}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((asset) => {
              const warranty = warrantyState(asset, settings.warrantyAlertDays)
              return (
                <tr key={asset.uid} className="clickable" onClick={() => onSelect?.(asset)}>
                  <td>
                    <div className="max-w-[240px] truncate font-medium">{asset.name}</div>
                    <div className="mono max-w-[240px] truncate text-[10.5px] faint">
                      {asset.assetId}
                      {asset.serial ? ` · ${asset.serial}` : ''}
                    </div>
                  </td>
                  {showQuantity ? <td className="mono">{asset.units}</td> : null}
                  <td>
                    <span className="text-[12px]">{asset.category || <span className="faint">—</span>}</span>
                  </td>
                  <td>
                    <div className="text-[12px]">{asset.brand || <span className="faint">—</span>}</div>
                    {asset.model ? <div className="max-w-[160px] truncate text-[10.5px] faint">{asset.model}</div> : null}
                  </td>
                  <td>
                    {asset.employee ? <span className="text-[12px]">{asset.employee}</span> : <span className="badge badge-neutral">Unassigned</span>}
                  </td>
                  <td className="max-w-[150px] truncate text-[12px]">{asset.department || <span className="faint">—</span>}</td>
                  <td>
                    <Badge tone={STATUS_TONE[asset.status]} dot>
                      {asset.status}
                    </Badge>
                  </td>
                  <td className="mono text-[11.5px] muted">{asset.purchaseDate ? formatDate(asset.purchaseDate) : '—'}</td>
                  <td className="mono text-right text-[12px]">
                    {Number.isFinite(asset.price) ? formatCurrency(asset.price, settings.currency) : <span className="faint">—</span>}
                  </td>
                  <td>
                    {asset.warrantyEnd ? (
                      <div className="flex items-center gap-1.5">
                        <Badge tone={WARRANTY_TONE[warranty]}>{warranty === 'active' ? 'Active' : warranty === 'expiring' ? 'Expiring' : 'Expired'}</Badge>
                        <span className="mono text-[10.5px] faint">{formatDate(asset.warrantyEnd)}</span>
                      </div>
                    ) : (
                      <span className="faint">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
            {!pageRows.length ? (
              <tr>
                <td colSpan={COLUMNS.length + (showQuantity ? 1 : 0)} className="py-10 text-center">
                  <p className="text-[13px] font-medium">No assets match these filters</p>
                  <button type="button" className="btn btn-sm mt-3" onClick={clearFilters}>
                    Reset filters
                  </button>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3">
        <div className="flex items-center gap-2 text-[11.5px] faint">
          <span>Rows per page</span>
          <select className="select w-auto" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span className="hidden sm:inline">
            {filtered.length ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)} of ${filtered.length}` : '0 results'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" className="btn btn-sm" disabled={currentPage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            <ChevronLeft size={14} />
          </button>
          <span className="mono px-1 text-[11.5px] faint">
            Page {currentPage} / {pageCount}
          </span>
          <button type="button" className="btn btn-sm" disabled={currentPage === pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

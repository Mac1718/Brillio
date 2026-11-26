import { useEffect } from 'react'
import { Download, X } from 'lucide-react'
import { Badge, DataList } from './ui'
import { TONE_CLASS, formatCurrency, formatDate, titleCase } from '../lib/format'
import { warrantyState } from '../lib/normalize'
import { downloadAssets } from '../lib/exporter'

const WARRANTY_TONE = { active: 'green', expiring: 'amber', expired: 'red', unknown: 'neutral' }

function ageLabel(date) {
  if (!date) return ''
  const years = (Date.now() - date.getTime()) / (365.25 * 24 * 3600 * 1000)
  if (years < 0) return 'acquired in the future'
  if (years < 1) return `${Math.round(years * 12)} months old`
  return `${years.toFixed(1)} years old`
}

export default function AssetDrawer({ asset, settings, onClose, onExport }) {
  useEffect(() => {
    if (!asset) return
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [asset, onClose])

  if (!asset) return null
  const state = warrantyState(asset, settings.warrantyAlertDays)
  const rawRows = Object.entries(asset.raw || {}).map(([label, value]) => ({
    label,
    value: value instanceof Date ? formatDate(value) : String(value ?? ''),
  }))

  const groups = [
    {
      title: 'Asset information',
      rows: [
        { label: 'Asset ID', value: asset.assetId },
        { label: 'Serial number', value: asset.serial },
        { label: 'Asset name', value: asset.name },
        {
          label: 'Quantity',
          value: asset.units > 1 ? `${asset.units} units` : asset.quantity != null ? `${asset.quantity}` : '',
        },
        { label: 'Category', value: asset.categoryRaw || asset.category },
        { label: 'Brand', value: asset.brand },
        { label: 'Model', value: asset.model },
        { label: 'Operating system', value: asset.os },
        { label: 'Supplier', value: asset.supplier },
      ],
    },
    {
      title: 'Assignment',
      rows: [
        { label: 'Assigned to', value: asset.employee || 'Unassigned' },
        { label: 'Department', value: asset.department },
        { label: 'Location', value: asset.location },
        { label: 'Status', value: asset.statusRaw || asset.status },
      ],
    },
    {
      title: 'Purchase & value',
      rows: [
        { label: 'Purchase date', value: asset.purchaseDate ? `${formatDate(asset.purchaseDate)} · ${ageLabel(asset.purchaseDate)}` : '' },
        { label: 'Purchase price', value: Number.isFinite(asset.price) ? formatCurrency(asset.price, settings.currency) : '' },
        {
          label: 'Line total',
          value: asset.units > 1 && Number.isFinite(asset.price) ? formatCurrency(asset.price * asset.units, settings.currency) : '',
        },
        {
          label: 'Current value',
          value: Number.isFinite(asset.currentValue) ? (
            <span>
              {formatCurrency(asset.currentValue, settings.currency)}
              {asset.valueDerived ? <span className="ml-1.5 text-[11px] faint">(straight-line, {settings.usefulLifeYears}y)</span> : null}
            </span>
          ) : (
            ''
          ),
        },
      ],
    },
    {
      title: 'Warranty & maintenance',
      rows: [
        { label: 'Warranty start', value: asset.warrantyStart ? formatDate(asset.warrantyStart) : '' },
        { label: 'Warranty expiry', value: asset.warrantyEnd ? formatDate(asset.warrantyEnd) : '' },
        {
          label: 'Warranty status',
          value: asset.warrantyEnd ? (
            <Badge tone={WARRANTY_TONE[state]}>
              {state === 'active' ? 'Active' : state === 'expiring' ? 'Expiring soon' : state === 'expired' ? 'Expired' : 'Unknown'}
            </Badge>
          ) : (
            ''
          ),
        },
        { label: 'Last maintenance', value: asset.lastMaintenance ? formatDate(asset.lastMaintenance) : '' },
        { label: 'Maintenance cost', value: Number.isFinite(asset.maintenanceCost) ? formatCurrency(asset.maintenanceCost, settings.currency) : '' },
        { label: 'Repair status', value: asset.repairStatus },
      ],
    },
    {
      title: 'Hardware',
      rows: [
        { label: 'RAM', value: asset.ram?.label },
        { label: 'Storage', value: asset.storage?.label },
        { label: 'Storage type', value: asset.storageType },
        { label: 'Processor', value: asset.processor },
      ],
    },
    {
      title: 'Notes',
      rows: [{ label: 'Notes', value: asset.notes }],
    },
  ]

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`Asset ${asset.assetId}`}>
        <div className="flex items-start gap-3 border-b p-5">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <span className={`badge ${TONE_CLASS[asset.status === 'Available' ? 'green' : asset.status === 'Assigned' ? 'blue' : asset.status === 'Maintenance' ? 'amber' : asset.status === 'Damaged' ? 'red' : 'neutral']}`} style={{ background: 'var(--panel-2)' }}>
                {asset.category || 'Uncategorised'}
              </span>
              {asset.statusRaw || asset.status ? <Badge tone={asset.status === 'Damaged' ? 'red' : asset.status === 'Maintenance' ? 'amber' : asset.status === 'Available' ? 'green' : 'neutral'}>{asset.statusRaw || asset.status}</Badge> : null}
            </div>
            <h2 className="truncate text-[17px] font-semibold tracking-[-0.02em]">{asset.name}</h2>
            <p className="mono mt-1 text-[11.5px] faint">
              {asset.assetId}
              {asset.serial ? ` · ${asset.serial}` : ''}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close details">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {groups.map((group) => {
            const visible = group.rows.filter((row) => row.value !== '' && row.value != null)
            if (!visible.length) return null
            return (
              <section key={group.title} className="mb-5">
                <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] faint">{group.title}</h3>
                <DataList rows={visible} />
              </section>
            )
          })}

          {rawRows.length ? (
            <details className="mt-2 rounded-[10px] border px-3 py-2.5">
              <summary className="cursor-pointer text-[11.5px] font-medium" style={{ color: 'var(--text-2)' }}>
                All source columns ({rawRows.length})
              </summary>
              <div className="mt-2">
                <DataList rows={rawRows} />
              </div>
            </details>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 border-t p-4">
          <span className="text-[11px] faint">Row {asset.uid + 1} of uploaded data</span>
          <div className="flex gap-2">
            <button type="button" className="btn btn-sm" onClick={() => (onExport ? onExport(asset) : downloadAssets([asset], `${asset.assetId}.xlsx`))}>
              <Download size={13} /> Export
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

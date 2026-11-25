import { useState } from 'react'
import { Download, Monitor, Moon, Sun, Trash2, UploadCloud } from 'lucide-react'
import { Card, CardHeader, MissingNotice, PageHeader, SectionTitle } from '../components/ui'
import { ASSET_FIELDS } from '../lib/fields'
import { CURRENCIES, formatDate } from '../lib/format'
import { downloadTemplate } from '../lib/exporter'

export default function Settings({ settings, setSettings, dataset, theme, setTheme, navigate, onRemoveDataset }) {
  const [confirmRemove, setConfirmRemove] = useState(false)
  const patch = (changes) => setSettings((prev) => ({ ...prev, ...changes }))

  const themes = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ]

  return (
    <div className="fade-in">
      <PageHeader title="Settings" description="Appearance, financial rules and dataset controls. Changes apply immediately and are stored in this browser." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Appearance" subtitle="Dashboard theme" />
          <div className="p-5">
            <div className="grid grid-cols-3 gap-2">
              {themes.map((option) => {
                const Icon = option.icon
                const active = theme === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTheme(option.value)}
                    className="flex flex-col items-center gap-2 rounded-[10px] border px-3 py-4 text-[12px] transition"
                    style={
                      active
                        ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 600 }
                        : { background: 'var(--panel)', color: 'var(--text-2)' }
                    }
                  >
                    <Icon size={17} />
                    {option.label}
                  </button>
                )
              })}
            </div>
            <p className="mt-3 text-[11.5px] faint">Theme preference is remembered locally. System follows your operating system.</p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Financial rules" subtitle="Used for value and cost calculations" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div>
              <label className="field-label">Currency</label>
              <select className="select" value={settings.currency} onChange={(event) => patch({ currency: event.target.value })}>
                {CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Useful life (years)</label>
              <input
                type="number"
                min="0"
                max="20"
                step="0.5"
                className="input"
                value={settings.usefulLifeYears}
                onChange={(event) => patch({ usefulLifeYears: Math.max(0, Number(event.target.value) || 0) })}
              />
            </div>
            <div>
              <label className="field-label">Warranty alert window (days)</label>
              <input
                type="number"
                min="0"
                max="365"
                className="input"
                value={settings.warrantyAlertDays}
                onChange={(event) => patch({ warrantyAlertDays: Math.max(0, Number(event.target.value) || 0) })}
              />
            </div>
            <div>
              <label className="field-label">Default rows per page</label>
              <select className="select" value={settings.pageSize} onChange={(event) => patch({ pageSize: Number(event.target.value) })}>
                {[10, 25, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="field-label">Ambiguous date format</label>
              <select className="select" value={settings.dateOrder} onChange={(event) => patch({ dateOrder: event.target.value })}>
                <option value="auto">Auto-detect from the workbook{dataset ? ` (detected: ${dataset.dateOrder === 'mdy' ? 'month first' : 'day first'})` : ''}</option>
                <option value="dmy">Day first — 31/12/2025</option>
                <option value="mdy">Month first — 12/31/2025</option>
              </select>
              <p className="mt-1.5 text-[11px] faint">Only affects dates that are ambiguous in the source file.</p>
            </div>
          </div>
        </Card>
      </div>

      <SectionTitle>Active dataset</SectionTitle>
      {dataset ? (
        <Card>
          <CardHeader
            title={dataset.fileName}
            subtitle={`${dataset.sheetName} · imported ${formatDate(dataset.importedAt)} · ${dataset.rows.length} rows`}
            action={
              <button type="button" className="btn btn-sm" onClick={() => navigate('upload')}>
                <UploadCloud size={13} /> Replace
              </button>
            }
          />
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            {[
              ['Worksheets', dataset.sheetNames?.length || 1],
              ['Source columns', dataset.headers.length],
              ['Mapped fields', Object.keys(dataset.mapping).length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[10px] border px-3 py-2.5" style={{ background: 'var(--panel-2)' }}>
                <div className="text-[10px] font-semibold uppercase tracking-[0.07em] faint">{label}</div>
                <div className="mono mt-0.5 text-[16px] font-semibold">{value}</div>
              </div>
            ))}
          </div>

          <div className="border-t px-5 py-4">
            <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] faint">Detected columns</div>
            <div className="flex flex-wrap gap-1.5">
              {ASSET_FIELDS.filter((field) => dataset.mapping[field.key] != null).map((field) => (
                <span key={field.key} className="badge">
                  <span style={{ color: 'var(--text-3)' }}>{field.label}</span>
                  <span className="opacity-40">→</span>
                  {dataset.headers[dataset.mapping[field.key]]}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-4">
            <button type="button" className="btn btn-sm" onClick={downloadTemplate}>
              <Download size={13} /> Asset template
            </button>
            {!onRemoveDataset ? null : confirmRemove ? (
              <div className="flex items-center gap-2">
                <span className="text-[11.5px]" style={{ color: 'var(--red)' }}>
                  Remove the saved dataset?
                </span>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    onRemoveDataset()
                    setConfirmRemove(false)
                  }}
                  style={{ color: 'var(--red)' }}
                >
                  <Trash2 size={13} /> Remove
                </button>
                <button type="button" className="btn btn-sm" onClick={() => setConfirmRemove(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <button type="button" className="btn btn-sm" onClick={() => setConfirmRemove(true)}>
                <Trash2 size={13} /> Remove saved data
              </button>
            )}
          </div>
        </Card>
      ) : (
        <Card className="p-6 text-center">
          <p className="text-[13px] font-medium">No dataset is loaded</p>
          <p className="mt-1 text-[12px] muted">Upload an Excel workbook to start using the dashboard.</p>
          <button type="button" className="btn btn-primary mt-4" onClick={() => navigate('upload')}>
            <UploadCloud size={14} /> Upload Excel
          </button>
        </Card>
      )}

      <SectionTitle>Data and access</SectionTitle>
      <MissingNotice>
        Workbooks are parsed and validated on the server, and saved records live in the application database. Uploaded files are kept in the configured upload directory for audit.
        Your role ({`admin, manager or user`}) is checked by the API on every request, so interface changes cannot grant extra permissions.
      </MissingNotice>
    </div>
  )
}

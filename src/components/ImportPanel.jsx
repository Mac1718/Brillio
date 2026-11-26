import { useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, RefreshCw, UploadCloud, X } from 'lucide-react'
import { Badge, Card, CardHeader } from './ui'
import { api } from '../lib/api'

const ACCEPT = '.xlsx,.xls,.csv'
const ACCEPT_RE = /\.(xlsx|xls|csv)$/i

export default function ImportPanel({ onImported, notify }) {
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [overrides, setOverrides] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [dragging, setDragging] = useState(false)

  const runPreview = async (nextFile, nextOverrides) => {
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const form = new FormData()
      form.append('file', nextFile)
      if (Object.keys(nextOverrides).length) form.append('overrides', JSON.stringify(nextOverrides))
      setPreview(await api.upload('/assessments/import/preview', form))
    } catch (err) {
      setPreview(null)
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const accept = (nextFile) => {
    if (!nextFile) return
    if (!ACCEPT_RE.test(nextFile.name)) {
      setPreview(null)
      setFile(null)
      setError(`“${nextFile.name}” is not a supported file. Upload an .xlsx, .xls or .csv file.`)
      return
    }
    setFile(nextFile)
    setOverrides({})
    runPreview(nextFile, {})
  }

  const onDrop = (event) => {
    event.preventDefault()
    setDragging(false)
    accept(event.dataTransfer.files?.[0])
  }

  const chooseColumn = (key) => (event) => {
    const value = event.target.value
    const next = { ...overrides, [key]: value === '' ? -1 : Number(value) }
    setOverrides(next)
    if (file) runPreview(file, next)
  }

  const commit = async () => {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      if (Object.keys(overrides).length) form.append('overrides', JSON.stringify(overrides))
      const response = await api.upload('/assessments/import/commit', form)
      setResult(response)
      notify?.(`Imported ${response.summary.imported} assessment${response.summary.imported === 1 ? '' : 's'}`)
      setPreview(null)
      setFile(null)
      onImported?.(response)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setFile(null)
    setPreview(null)
    setOverrides({})
    setError('')
    setResult(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const summary = preview?.summary
  const missing = preview?.missingMandatory || []
  const exactDuplicates = preview?.duplicates?.exact || []
  const fieldDuplicates = preview?.duplicates?.fields || []
  const canImport = Boolean(preview && summary?.valid > 0 && !missing.length && !exactDuplicates.length)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Upload a Register" subtitle="Columns are detected automatically; every row is validated before anything is saved." />

        <div className="p-4 sm:p-5">
          <div
            className={`dropzone ${dragging ? 'dragging' : ''}`}
            onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click() }}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(event) => accept(event.target.files?.[0])}
            />
            <div className="dropzone-icon"><UploadCloud size={20} /></div>
            <div className="text-[13px] font-semibold">Drop your Excel file here</div>
            <div className="mt-0.5 text-[11.5px] muted">or click to browse · .xlsx, .xls, .csv · up to 25 MB</div>
            {file ? (
              <div className="dropzone-file">
                <FileSpreadsheet size={14} />
                <span className="truncate">{file.name}</span>
                <span className="faint">{Math.round(file.size / 1024)} KB</span>
                <button
                  type="button"
                  className="input-toggle"
                  onClick={(event) => { event.stopPropagation(); reset() }}
                  aria-label="Remove file"
                >
                  <X size={13} />
                </button>
              </div>
            ) : null}
          </div>

          {busy && !preview ? <div className="mt-3 text-[12px] muted">Reading and validating the workbook…</div> : null}
          {error ? <div className="auth-error mt-3" role="alert">{error}</div> : null}

          {result ? (
            <div className="mt-3 rounded-[10px] px-3 py-2.5 text-[12px]" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>
              <div className="flex items-center gap-2 font-semibold"><CheckCircle2 size={14} /> Import complete</div>
              <div className="mt-1">
                {result.summary.imported} imported · {result.summary.duplicates} duplicate{result.summary.duplicates === 1 ? '' : 's'} skipped · {result.summary.invalid} invalid.
                {result.vendorSummary
                  ? ` ${result.vendorSummary.matchedCount} vendor${result.vendorSummary.matchedCount === 1 ? '' : 's'} matched · ${result.vendorSummary.createCount} new vendor${result.vendorSummary.createCount === 1 ? '' : 's'} created.`
                  : ''}
              </div>
              {result.vendorSummary?.ambiguous?.length ? (
                <div className="mt-1">
                  Flagged for review: {result.vendorSummary.ambiguous.map((entry) => `${entry.name} (similar to ${entry.similarTo})`).join(', ')}.
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </Card>

      {preview ? (
        <Card>
          <CardHeader
            title={`Preview · ${preview.sheetName}`}
            subtitle={`${preview.fileName} · ${summary.total} row${summary.total === 1 ? '' : 's'} found`}
            action={
              <div className="flex gap-2">
                <button type="button" className="btn btn-sm" onClick={() => file && runPreview(file, overrides)} disabled={busy}>
                  <RefreshCw size={13} /> Re-check
                </button>
                <button type="button" className="btn btn-sm" onClick={reset}>Discard</button>
              </div>
            }
          />

          <div className="p-4 pt-2">
            <div className="mb-3 grid gap-2 sm:grid-cols-4">
              {[
                { label: 'Rows', value: summary.total, tone: 'neutral' },
                { label: 'Ready', value: summary.valid, tone: 'green' },
                { label: 'Duplicates', value: summary.duplicates, tone: 'amber' },
                { label: 'Invalid', value: summary.invalid, tone: 'red' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-[9px] px-3 py-2" style={{ background: 'var(--panel-2)' }}>
                  <div className="text-[11.5px] font-medium uppercase tracking-[0.05em] faint">{stat.label}</div>
                  <div className="mono mt-0.5 text-[16px] font-semibold">{stat.value}</div>
                </div>
              ))}
            </div>

            {missing.length ? (
              <div className="mb-3 flex items-start gap-2 rounded-[10px] px-3 py-2.5 text-[12px]" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>
                <AlertTriangle size={14} className="mt-0.5 flex-none" />
                <div>
                  <div className="font-semibold">Cannot import until this is resolved</div>
                  <div className="mt-0.5">
                    Missing: {missing.join(', ')}. The financial year and quarter come from the PO Date, so the sheet needs
                    a readable PO Date column.
                    {preview.headers?.length ? ' Map the columns below and re-check.' : null}
                  </div>
                </div>
              </div>
            ) : null}

            {exactDuplicates.length ? (
              <div className="mb-3 flex items-start gap-2 rounded-[10px] px-3 py-2.5 text-[12px]" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}>
                <AlertTriangle size={14} className="mt-0.5 flex-none" />
                <div>
                  <div className="font-semibold">Duplicate columns after normalisation</div>
                  <div className="mt-0.5">
                    {exactDuplicates.map((entry) => `“${entry.columns.join('” / “')}”`).join('; ')}. Header matching ignores case and spacing, so these
                    columns resolve to the same field. Keep one and re-upload before importing.
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mb-3 rounded-[10px] px-3 py-2.5 text-[11.5px]" style={{ background: 'var(--panel-2)', color: 'var(--text-2)' }}>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">Standard assessment columns</span>
                <span className="mono faint">
                  {preview.standard?.matchedCount ?? 0} of {preview.standard?.total ?? 21} matched
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(preview.standard?.matched || []).map((field) => (
                  <Badge key={field.key} tone="green">{field.label}</Badge>
                ))}
                {(preview.standard?.missing || []).map((field) => (
                  <Badge key={field.key} tone="neutral">{field.label}</Badge>
                ))}
              </div>
              {fieldDuplicates.length ? (
                <p className="mt-2" style={{ color: 'var(--amber)' }}>
                  More than one column maps to:{' '}
                  {fieldDuplicates.map((entry) => `${entry.label} (${entry.columns.join(', ')})`).join('; ')}. The first match is used.
                </p>
              ) : null}
              {preview.unrecognised?.length ? (
                <p className="mt-2">
                  Not part of the standard structure and ignored: {preview.unrecognised.join(', ')}.
                </p>
              ) : null}
            </div>

            <div className="mb-3 flex flex-wrap items-end gap-3">
              <label className="field" style={{ minWidth: 260 }}>
                <span className="field-label">PO date column — sets year &amp; quarter</span>
                <select className="input" value={overrides.poDate ?? preview.poDateColumn ?? ''} onChange={chooseColumn('poDate')}>
                  <option value="">Not mapped</option>
                  {preview.headers.map((header, index) => (
                    <option key={`${header}-${index}`} value={index}>{header}</option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap gap-1.5 pb-1">
                {preview.mappedFields.slice(0, 14).map((field) => (
                  <Badge key={field} tone="neutral">{field}</Badge>
                ))}
                {preview.mappedFields.length > 14 ? <Badge tone="neutral">+{preview.mappedFields.length - 14}</Badge> : null}
              </div>
            </div>

            <div className="table-scroll" style={{ maxHeight: 420 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Asset / project</th>
                    <th>PO date</th>
                    <th>Year (PO)</th>
                    <th>Quarter (PO)</th>
                    <th>Status</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row.rowNumber}>
                      <td className="mono faint">{row.rowNumber}</td>
                      <td>
                        <div className="font-medium">{row.record.assetId || row.record.serial || row.record.projectId || '—'}</div>
                        <div className="max-w-[220px] truncate text-[11px] faint">
                          {[row.record.projectId, row.record.department, row.record.category].filter(Boolean).join(' · ') || '—'}
                        </div>
                      </td>
                      <td className="mono">{row.record.poDate || '—'}</td>
                      <td className="mono">{row.record.assessmentYear ?? '—'}</td>
                      <td>{row.record.assessmentQuarter || '—'}</td>
                      <td>{row.record.assessmentStatus || '—'}</td>
                      <td>
                        {row.duplicate ? (
                          <Badge tone="amber">Duplicate</Badge>
                        ) : row.valid ? (
                          <Badge tone="green">Ready</Badge>
                        ) : (
                          <span className="text-[11.5px]" style={{ color: 'var(--red)' }}>
                            {row.errors.join('; ')}
                          </span>
                        )}
                        {row.warnings?.length ? <div className="mt-0.5 text-[10.5px] faint">{row.warnings.join('; ')}</div> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {preview.truncated ? <p className="mt-2 text-[11px] faint">Showing the first {preview.rows.length} rows. All {summary.total} rows are validated and imported when you continue.</p> : null}

            {preview.vendorSummary ? (
              <div className="mt-3 rounded-[10px] px-3 py-2.5 text-[11.5px]" style={{ background: 'var(--panel-2)', color: 'var(--text-2)' }}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">Vendor mapping</span>
                  <span className="mono faint">
                    {preview.vendorSummary.matchedCount} matched · {preview.vendorSummary.createCount} new
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <div className="text-[10.5px] font-semibold uppercase tracking-[0.05em] faint">Matched to existing vendors</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {preview.vendorSummary.existing.length ? (
                        preview.vendorSummary.existing.map((entry) => (
                          <Badge key={entry.vendorId} tone="green">
                            {entry.vendorName}{entry.count > 1 ? ` · ${entry.count} rows` : ''}
                          </Badge>
                        ))
                      ) : (
                        <span className="faint">None</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10.5px] font-semibold uppercase tracking-[0.05em] faint">New vendors to create</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {preview.vendorSummary.create.length ? (
                        preview.vendorSummary.create.map((entry) => (
                          <Badge key={entry.name} tone="blue">
                            {entry.name}{entry.count > 1 ? ` · ${entry.count} rows` : ''}
                          </Badge>
                        ))
                      ) : (
                        <span className="faint">None</span>
                      )}
                    </div>
                  </div>
                </div>
                {preview.vendorSummary.duplicates.length ? (
                  <p className="mt-2">
                    Repeated vendor names in this file (mapped once):{' '}
                    {preview.vendorSummary.duplicates.map((entry) => `${entry.name} ×${entry.count}`).join(', ')}.
                  </p>
                ) : null}
                {preview.vendorSummary.ambiguous.length ? (
                  <p className="mt-2" style={{ color: 'var(--amber)' }}>
                    Possible spelling variations flagged for Admin review:{' '}
                    {preview.vendorSummary.ambiguous
                      .map((entry) => `${entry.name} is ${entry.similarity}% similar to ${entry.similarTo}`)
                      .join('; ')}
                    . A separate vendor will be created rather than silently merging them.
                  </p>
                ) : null}
                {preview.vendorSummary.missingVendorNames ? (
                  <p className="mt-2">
                    {preview.vendorSummary.missingVendorNames} row{preview.vendorSummary.missingVendorNames === 1 ? '' : 's'} have no Vendor Name; those assessments stay unlinked.
                  </p>
                ) : null}
              </div>
            ) : preview.unmatchedVendors?.length ? (
              <div className="mt-3 rounded-[10px] px-3 py-2.5 text-[11.5px]" style={{ background: 'var(--panel-2)', color: 'var(--text-2)' }}>
                Vendor names not found in the vendor master: {preview.unmatchedVendors.join(', ')}. These records keep the name but are not linked to a vendor city until the vendor is added.
              </div>
            ) : null}

            <div className="modal-actions">
              <button type="button" className="btn" onClick={reset}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={commit} disabled={!canImport || busy}>
                {busy ? 'Importing…' : `Import ${summary.valid} assessment${summary.valid === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  )
}

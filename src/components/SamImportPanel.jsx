import { useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, RefreshCw, UploadCloud, X } from 'lucide-react'
import { Badge } from './ui'
import { api } from '../lib/api'

const ACCEPT = '.xlsx,.xls'
const ACCEPT_RE = /\.(xlsx|xls)$/i

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

const duplicateLabel = (duplicate) =>
  duplicate === 'database' ? 'Already in the register' : duplicate === 'file' ? 'Duplicate in this file' : null

export default function SamImportPanel({ onClose, onImported, notify }) {
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [dragging, setDragging] = useState(false)

  const runPreview = async (nextFile) => {
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const form = new FormData()
      form.append('file', nextFile)
      setPreview(await api.upload('/software/import/preview', form))
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
      setError(`“${nextFile.name}” is not supported. Upload an .xlsx or .xls file.`)
      return
    }
    setFile(nextFile)
    runPreview(nextFile)
  }

  const onDrop = (event) => {
    event.preventDefault()
    setDragging(false)
    accept(event.dataTransfer.files?.[0])
  }

  const commit = async () => {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const response = await api.upload('/software/import/commit', form)
      setResult(response)
      notify?.(`Imported ${response.summary.imported} software record${response.summary.imported === 1 ? '' : 's'}`)
      setPreview(null)
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
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
    setError('')
    setResult(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const summary = preview?.summary
  const missing = preview?.missingColumns || []
  const canImport = Boolean(preview && !missing.length && summary?.ready > 0)

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Upload SAM Excel">
      <div className="modal modal-lg">
        <div className="modal-head">
          <div>
            <h3>Upload SAM Excel</h3>
            <p className="text-[11.5px] faint">
              Five standard columns: Software Name, Software Vendor, Software Status, Purchase Date, Expire Date.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-sm" onClick={() => downloadTemplate(notify)}>
              <Download size={13} /> Template
            </button>
            <button type="button" className="btn btn-sm" onClick={onClose}>Close</button>
          </div>
        </div>

        <div className="modal-body">
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
            <div className="text-[13px] font-semibold">Drop the SAM workbook here</div>
            <div className="mt-0.5 text-[11.5px] muted">or click to browse · .xlsx, .xls · up to 25 MB</div>
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

          {busy && !preview ? <div className="text-[12px] muted">Reading and validating the workbook…</div> : null}
          {error ? <div className="auth-error" role="alert">{error}</div> : null}

          {result ? (
            <div className="rounded-[10px] px-3 py-2.5 text-[12px]" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>
              <div className="flex items-center gap-2 font-semibold"><CheckCircle2 size={14} /> SAM import complete</div>
              <div className="mt-1">
                {result.summary.imported} imported · {result.summary.duplicates} duplicate{result.summary.duplicates === 1 ? '' : 's'} skipped ·{' '}
                {result.summary.invalid} invalid skipped. Statistics refreshed from stored records.
              </div>
            </div>
          ) : null}

          {preview ? (
            <>
              <div className="grid gap-2 sm:grid-cols-4">
                {[
                  { label: 'Rows', value: summary.total, tone: 'neutral' },
                  { label: 'Ready', value: summary.ready, tone: 'green' },
                  { label: 'Duplicates', value: summary.duplicates, tone: 'amber' },
                  { label: 'Invalid', value: summary.invalid, tone: 'red' },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-[9px] px-3 py-2" style={{ background: 'var(--panel-2)' }}>
                    <div className="text-[11px] font-medium uppercase tracking-[0.05em] faint">{stat.label}</div>
                    <div className="mono mt-0.5 text-[16px] font-semibold">{stat.value}</div>
                  </div>
                ))}
              </div>

              {missing.length ? (
                <div className="flex items-start gap-2 rounded-[10px] px-3 py-2.5 text-[12px]" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>
                  <AlertTriangle size={14} className="mt-0.5 flex-none" />
                  <div>
                    <div className="font-semibold">Cannot import until this is resolved</div>
                    <div className="mt-0.5">
                      Missing required column{missing.length === 1 ? '' : 's'}: {missing.join(', ')}. Add the column and upload the file again.
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="rounded-[10px] px-3 py-2.5 text-[11.5px]" style={{ background: 'var(--panel-2)', color: 'var(--text-2)' }}>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">Standard SAM columns · sheet “{preview.sheetName}”</span>
                  <span className="mono faint">{preview.mappedColumns} of 5 matched</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {preview.detectedColumns.map((column) => (
                    <Badge key={column.key} tone={column.header ? 'green' : column.required ? 'red' : 'neutral'}>
                      {column.label}{column.header ? ` ← ${column.header}` : column.required ? ' · missing' : ' · optional, not found'}
                    </Badge>
                  ))}
                </div>
                {preview.duplicateColumns?.length ? (
                  <p className="mt-2" style={{ color: 'var(--amber)' }}>
                    More than one column maps to the same field: {preview.duplicateColumns.join(', ')}. The first match is used.
                  </p>
                ) : null}
                {preview.unrecognisedColumns?.length ? (
                  <p className="mt-2">
                    Not part of the SAM structure and not imported: {preview.unrecognisedColumns.join(', ')}.
                  </p>
                ) : null}
              </div>

              <div className="table-scroll" style={{ maxHeight: 380 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Software Name</th>
                      <th>Vendor</th>
                      <th>Status</th>
                      <th>Purchase Date</th>
                      <th>Expire Date</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr key={row.rowNumber}>
                        <td className="mono faint">{row.rowNumber}</td>
                        <td className="font-medium">{row.values.name || <span className="faint">—</span>}</td>
                        <td>{row.values.vendorName || '—'}</td>
                        <td>{row.values.softwareStatus || '—'}</td>
                        <td className="mono">{row.values.purchasedDate || '—'}</td>
                        <td className="mono">{row.values.expiryDate || '—'}</td>
                        <td>
                          {row.duplicate ? (
                            <Badge tone="amber">{duplicateLabel(row.duplicate)}</Badge>
                          ) : row.valid ? (
                            <Badge tone="green">Ready</Badge>
                          ) : (
                            <span className="text-[11.5px]" style={{ color: 'var(--red)' }}>{row.errors.join('; ')}</span>
                          )}
                          {row.warnings?.length ? <div className="mt-0.5 text-[10.5px] faint">{row.warnings.join('; ')}</div> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {preview.rowsTruncated || preview.truncated ? (
                <p className="text-[11px] faint">Showing the first {preview.rows.length} rows of {summary.total}. All {summary.total} rows are validated when you import.</p>
              ) : null}

              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => file && runPreview(file)} disabled={busy}>
                  <RefreshCw size={13} /> Re-check
                </button>
                <button type="button" className="btn" onClick={reset}>Discard</button>
                <button type="button" className="btn btn-primary" onClick={commit} disabled={!canImport || busy}>
                  {busy ? 'Importing…' : `Import ${summary.ready} record${summary.ready === 1 ? '' : 's'}`}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

import { useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  RotateCcw,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react'
import { ASSET_FIELDS, mappedFieldCount } from '../lib/fields'
import { buildDataset, detectSheetStructure, readWorkbookFile } from '../lib/excel'
import { downloadTemplate } from '../lib/exporter'
import { Badge } from './ui'

const formatSize = (bytes) => {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function UploadPanel({ currentDataset, onImport, notify }) {
  const inputRef = useRef(null)
  const [sheets, setSheets] = useState(null)
  const [file, setFile] = useState(null)
  const [activeSheet, setActiveSheet] = useState('')
  const [structure, setStructure] = useState(null)
  const [mapping, setMapping] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)

  const reset = () => {
    setSheets(null)
    setFile(null)
    setActiveSheet('')
    setStructure(null)
    setMapping({})
    setError('')
  }

  const applySheet = (list, name) => {
    const sheet = list.find((item) => item.name === name)
    if (!sheet) return
    const detected = detectSheetStructure(sheet.matrix)
    setActiveSheet(name)
    if (!detected) {
      setStructure(null)
      setMapping({})
      setError('This worksheet is empty. Choose another worksheet or a different file.')
      return
    }
    setStructure(detected)
    setMapping(detected.mapping)
    if (!mappedFieldCount(detected.mapping)) {
      setError('No familiar column headings were recognised on this sheet. Map the columns manually below and continue.')
    } else {
      setError('')
    }
  }

  const handleFile = async (incoming) => {
    if (!incoming) return
    if (!/\.(xlsx|xls|csv)$/i.test(incoming.name)) {
      setError(`“${incoming.name}” is not a supported file. Upload an .xlsx, .xls or .csv file.`)
      return
    }
    setLoading(true)
    setError('')
    reset()
    try {
      const parsed = await readWorkbookFile(incoming)
      let bestSheet = parsed[0].name
      let bestScore = -1
      parsed.forEach((sheet) => {
        const detected = detectSheetStructure(sheet.matrix)
        const score = detected ? mappedFieldCount(detected.mapping) * 1000 + detected.rows.length : -1
        if (score > bestScore) {
          bestScore = score
          bestSheet = sheet.name
        }
      })
      setSheets(parsed)
      setFile(incoming)
      applySheet(parsed, bestSheet)
    } catch (err) {
      setError(
        err?.message?.includes('password')
          ? 'This workbook is password protected. Remove the password and upload it again.'
          : `“${incoming.name}” could not be read. Make sure it is a valid Excel workbook or CSV file.`,
      )
    } finally {
      setLoading(false)
    }
  }

  const setField = (fieldKey, columnIndex) => {
    setError('')
    setMapping((prev) => {
      const next = { ...prev }
      if (columnIndex === '' || columnIndex == null) delete next[fieldKey]
      else {
        Object.keys(next).forEach((key) => {
          if (next[key] === Number(columnIndex) && key !== fieldKey) delete next[key]
        })
        next[fieldKey] = Number(columnIndex)
      }
      return next
    })
  }

  const handleImport = () => {
    if (!structure || !sheets) return
    try {
      const dataset = buildDataset({
        file,
        sheetName: activeSheet,
        headers: structure.headers,
        rows: structure.rows,
        mapping,
        headerRowIndex: structure.rowIndex,
        sheets,
      })
      onImport(dataset)
      notify?.(`Dashboard updated with ${dataset.rows.length} assets`)
      reset()
    } catch (err) {
      setError(err.message || 'The dataset could not be built from this sheet.')
    }
  }

  const detectedCount = mappedFieldCount(mapping)
  const usedColumns = new Set(Object.values(mapping))
  const unmapped = structure ? structure.headers.map((header, index) => ({ header, index })).filter((item) => !usedColumns.has(item.index)) : []
  const previewColumns = structure ? structure.headers.slice(0, 14) : []

  return (
    <div className="space-y-4">
      {!sheets ? (
        <div
          className={`dropzone ${dragging ? 'dragging' : ''}`}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            handleFile(event.dataTransfer.files?.[0])
          }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click()
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(event) => {
              handleFile(event.target.files?.[0])
              event.target.value = ''
            }}
          />
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            {loading ? <Loader2 size={24} className="animate-spin" /> : <UploadCloud size={24} strokeWidth={1.7} />}
          </div>
          <h3 className="text-[16px] font-semibold tracking-[-0.01em]">{loading ? 'Reading workbook…' : 'Drop your Excel workbook here'}</h3>
          <p className="mx-auto mt-1.5 max-w-md text-[12.5px] muted">
            Drag and drop an .xlsx, .xls or .csv file, or click to browse. Columns are detected automatically — nothing is sent to a server.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={(event) => {
                event.stopPropagation()
                inputRef.current?.click()
              }}
            >
              <FileSpreadsheet size={14} /> Browse files
            </button>
            <button
              type="button"
              className="btn"
              onClick={(event) => {
                event.stopPropagation()
                downloadTemplate()
              }}
            >
              <Download size={14} /> Download template
            </button>
          </div>
          <p className="mt-4 text-[11px] faint">Supports multiple worksheets · automatic header &amp; column detection · 100% local processing</p>
        </div>
      ) : null}

      {!sheets && error ? (
        <div className="notice">
          <AlertCircle size={15} className="mt-0.5 flex-none" />
          <span>{error}</span>
        </div>
      ) : null}

      {sheets ? (
        <>
          <div className="card p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="grid h-10 w-10 flex-none place-items-center rounded-[10px]" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                <FileSpreadsheet size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold">{file?.name}</div>
                <div className="text-[11.5px] faint">
                  {formatSize(file?.size)} · {sheets.length} worksheet{sheets.length > 1 ? 's' : ''} · {detectedCount} columns auto-mapped
                </div>
              </div>
              <button type="button" className="btn btn-sm" onClick={() => inputRef.current?.click()}>
                <UploadCloud size={13} /> Change file
              </button>
              <button type="button" className="icon-btn" onClick={reset} aria-label="Remove file">
                <X size={15} />
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(event) => {
                  handleFile(event.target.files?.[0])
                  event.target.value = ''
                }}
              />
            </div>

            <div className="mt-4 border-t pt-3">
              <div className="field-label">Worksheet</div>
              <div className="flex flex-wrap gap-2">
                {sheets.map((sheet) => (
                  <button
                    key={sheet.name}
                    type="button"
                    onClick={() => {
                      setError('')
                      applySheet(sheets, sheet.name)
                    }}
                    className="rounded-[8px] border px-3 py-1.5 text-[12px] transition"
                    style={
                      activeSheet === sheet.name
                        ? { background: 'var(--text)', color: 'var(--panel)', borderColor: 'transparent', fontWeight: 550 }
                        : { background: 'var(--panel)', color: 'var(--text-2)' }
                    }
                  >
                    {sheet.name}
                    <span className="ml-1.5 text-[10.5px] opacity-60">{sheet.matrix.length}</span>
                  </button>
                ))}
              </div>
              {structure ? (
                <p className="mt-2 text-[11.5px] faint">
                  Header row detected · {structure.rows.length} data rows · {structure.headers.length} columns
                </p>
              ) : null}
            </div>
          </div>

          {error ? (
            <div className="notice">
              <AlertCircle size={15} className="mt-0.5 flex-none" />
              <span>{error}</span>
            </div>
          ) : null}

          {structure ? (
            <>
              <div className="card">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4">
                  <div>
                    <h3 className="text-[14px] font-semibold">Column mapping</h3>
                    <p className="mt-0.5 text-[11.5px] faint">Fields are matched automatically. Adjust any that look wrong.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={detectedCount ? 'green' : 'amber'} dot>
                      {detectedCount} of {ASSET_FIELDS.length} fields mapped
                    </Badge>
                    <button type="button" className="btn btn-sm" onClick={() => applySheet(sheets, activeSheet)}>
                      <Sparkles size={13} /> Auto-detect
                    </button>
                  </div>
                </div>
                <div className="grid gap-x-4 gap-y-2.5 p-5 sm:grid-cols-2 xl:grid-cols-3">
                  {ASSET_FIELDS.map((field) => (
                    <div key={field.key} className="flex items-center gap-2">
                      <label className="w-[132px] flex-none truncate text-[11.5px]" style={{ color: mapping[field.key] != null ? 'var(--text)' : 'var(--text-3)' }} title={field.label}>
                        {field.label}
                      </label>
                      <select
                        className="select h-8 flex-1 text-[11.5px]"
                        value={mapping[field.key] ?? ''}
                        onChange={(event) => setField(field.key, event.target.value)}
                      >
                        <option value="">— not mapped —</option>
                        {structure.headers.map((header, index) => (
                          <option key={index} value={index}>
                            {header}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                {unmapped.length ? (
                  <div className="border-t px-5 py-3">
                    <span className="text-[11px] faint">Unmapped source columns ({unmapped.length}): </span>
                    {unmapped.slice(0, 10).map((item) => (
                      <span key={item.index} className="badge ml-1 mt-1">
                        {item.header}
                      </span>
                    ))}
                    {unmapped.length > 10 ? <span className="ml-1 text-[11px] faint">+{unmapped.length - 10} more</span> : null}
                  </div>
                ) : null}
              </div>

              <div className="card overflow-hidden">
                <div className="flex items-center justify-between border-b px-5 py-3">
                  <h3 className="text-[13px] font-semibold">Data preview</h3>
                  <span className="text-[11px] faint">First {Math.min(6, structure.rows.length)} of {structure.rows.length} rows</span>
                </div>
                <div className="table-wrap" style={{ maxHeight: 300 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        {previewColumns.map((header, index) => (
                          <th key={index} className="max-w-[160px] truncate normal-case tracking-normal">
                            {header}
                          </th>
                        ))}
                        {structure.headers.length > previewColumns.length ? <th>+{structure.headers.length - previewColumns.length}</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {structure.rows.slice(0, 6).map((row) => (
                        <tr key={row.__row}>
                          <td className="faint">{row.__row}</td>
                          {previewColumns.map((_, index) => {
                            const cell = row.cells[index]
                            const text = cell instanceof Date ? cell.toLocaleDateString('en-GB') : String(cell ?? '')
                            return (
                              <td key={index} className="max-w-[160px] truncate">
                                {text || <span className="faint">—</span>}
                              </td>
                            )
                          })}
                          {structure.headers.length > previewColumns.length ? <td className="faint">…</td> : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="mt-0.5 flex-none" style={{ color: 'var(--green)' }} />
                  <div>
                    <div className="text-[12.5px] font-medium">
                      {mapping.category != null ? 'Ready to build the dashboard' : 'Map at least one meaningful column to continue'}
                    </div>
                    <div className="text-[11.5px] faint">
                      {currentDataset
                        ? `This replaces “${currentDataset.fileName}” as the active dataset.`
                        : `${structure.rows.length} assets will be loaded into the dashboard.`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" className="btn" onClick={reset}>
                    <RotateCcw size={13} /> Cancel
                  </button>
                  <button type="button" className="btn btn-accent" onClick={handleImport} disabled={!detectedCount}>
                    <CheckCircle2 size={14} /> Build dashboard
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

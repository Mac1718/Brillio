import * as XLSX from 'xlsx'
import { ASSET_FIELDS, MAINTENANCE_FIELDS, TICKET_FIELDS, detectMapping, mappedFieldCount, normalizeHeader } from './fields'

const MAX_HEADER_SCAN = 12

export async function readWorkbookFile(file) {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  if (!wb.SheetNames.length) throw new Error('This workbook has no worksheets.')
  return wb.SheetNames.map((name) => {
    const sheet = wb.Sheets[name]
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '', blankrows: false })
    return { name, matrix }
  })
}

function cleanHeaders(row) {
  const seen = new Map()
  return row.map((cell, index) => {
    let label = String(cell ?? '').replace(/\s+/g, ' ').trim()
    if (!label) label = `Column ${index + 1}`
    const count = seen.get(label) || 0
    seen.set(label, count + 1)
    return count ? `${label} (${count + 1})` : label
  })
}

/** Locate the header row: the row that matches the most known columns. */
export function detectSheetStructure(matrix, fields = ASSET_FIELDS) {
  // Keep the original row number while ignoring blank spacer rows.
  const entries = matrix
    .map((row, index) => ({ row, index }))
    .filter((entry) => entry.row.some((cell) => String(cell ?? '').trim() !== ''))
  if (!entries.length) return null

  let best = { position: 0, rowIndex: entries[0].index, mapping: {}, matches: -1 }
  entries.slice(0, MAX_HEADER_SCAN).forEach((entry, position) => {
    const mapping = detectMapping(entry.row, fields)
    const matches = mappedFieldCount(mapping)
    if (matches > best.matches) best = { position, rowIndex: entry.index, mapping, matches }
  })
  if (best.matches < 1) best.position = 0

  const headerRow = entries[best.position].row
  const headers = cleanHeaders(headerRow || [])
  const rows = entries
    .slice(best.position + 1)
    .map((entry, index) => ({
      __row: entry.index + 1,
      cells: headers.map((_, i) => entry.row[i] ?? ''),
    }))
  return { rowIndex: best.rowIndex, headers, headerRow, mapping: best.mapping, matches: best.matches, rows }
}

/** Infer whether ambiguous date strings are day-first or month-first. */
export function inferDateOrder(values) {
  let dayFirst = 0
  let monthFirst = 0
  values.forEach((value) => {
    if (typeof value !== 'string') return
    const match = value.match(/^\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\s*$/)
    if (!match) return
    const a = Number(match[1])
    const b = Number(match[2])
    if (a > 12 && b <= 12) dayFirst += 1
    else if (b > 12 && a <= 12) monthFirst += 1
  })
  if (monthFirst > dayFirst) return 'mdy'
  return 'dmy'
}

function sheetKeywordScore(headers, pattern) {
  return headers.reduce((score, header) => score + (pattern.test(normalizeHeader(header)) ? 1 : 0), 0)
}

function detectMaintenanceSheet(sheets, mainSheetName, skipNames = new Set()) {
  for (const sheet of sheets) {
    if (sheet.name === mainSheetName || skipNames.has(sheet.name)) continue
    const structure = detectSheetStructure(sheet.matrix, MAINTENANCE_FIELDS)
    if (!structure) continue
    const mapping = structure.mapping
    const maintenanceHeaders = sheetKeywordScore(structure.headers, /(mainten|repair|service|work order|fault)/)
    const costOrDate = mapping.cost != null || mapping.date != null
    // A maintenance worksheet must actually talk about maintenance, and carry at
    // least one operational column (date, cost or status).
    if (mappedFieldCount(mapping) >= 3 && maintenanceHeaders >= 1 && costOrDate && structure.rows.length > 0) {
      return { sheetName: sheet.name, headers: structure.headers, rows: structure.rows, mapping }
    }
  }
  return null
}

function detectTicketsSheet(sheets, mainSheetName, skipNames = new Set()) {
  for (const sheet of sheets) {
    if (sheet.name === mainSheetName || skipNames.has(sheet.name)) continue
    const structure = detectSheetStructure(sheet.matrix, TICKET_FIELDS)
    if (!structure) continue
    const mapping = structure.mapping
    const timingSignals = ['opened', 'resolved', 'resolutionHours'].filter((key) => mapping[key] != null).length
    const identitySignal = mapping.ticketId != null || mapping.subject != null
    const ticketHeaders = sheetKeywordScore(structure.headers, /(ticket|issue|incident|case|helpdesk)/)
    // A second asset or maintenance sheet must not be mistaken for support tickets.
    if (mappedFieldCount(mapping) >= 3 && (timingSignals >= 1 || ticketHeaders >= 1) && identitySignal && structure.rows.length > 0) {
      return { sheetName: sheet.name, headers: structure.headers, rows: structure.rows, mapping }
    }
  }
  return null
}

/**
 * Turn a parsed sheet + mapping into the persisted dataset shape.
 */
export function buildDataset({ file, sheetName, headers, rows, mapping, headerRowIndex, sheets }) {
  const mappingColumns = Object.values(mapping || {}).filter((v) => v != null)
  if (!mappingColumns.length) throw new Error('No recognisable asset columns were found. Map at least one column to continue.')
  if (!rows.length) throw new Error('This worksheet has a header row but no asset rows underneath it.')

  const dateColumns = ['purchaseDate', 'warrantyStart', 'warrantyEnd', 'lastMaintenance']
    .map((key) => mapping[key])
    .filter((idx) => idx != null)
  const dateValues = rows.flatMap((row) => dateColumns.map((col) => row.cells[col]))
  const maintenance = sheets ? detectMaintenanceSheet(sheets, sheetName) : null
  const tickets = sheets
    ? detectTicketsSheet(sheets, sheetName, new Set(maintenance ? [maintenance.sheetName] : []))
    : null

  return {
    fileName: file?.name || 'Dataset',
    fileSize: file?.size || 0,
    sheetName,
    sheetNames: sheets ? sheets.map((s) => s.name) : [sheetName],
    headers,
    rows: rows.map((row) => row.cells),
    mapping,
    headerRowIndex: headerRowIndex ?? 0,
    dateOrder: inferDateOrder(dateValues),
    importedAt: new Date().toISOString(),
    tickets,
    maintenance,
  }
}

export function remapDataset(dataset, sheetName, headers, rows, mapping, headerRowIndex, sheets) {
  return buildDataset({
    file: { name: dataset.fileName, size: dataset.fileSize },
    sheetName,
    headers,
    rows,
    mapping,
    headerRowIndex,
    sheets,
  })
}

export const headerKey = normalizeHeader

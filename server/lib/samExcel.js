import * as XLSX from 'xlsx'
import { HttpError } from './http.js'
import { isoDate, parseAssessmentDate } from './validate.js'
import { dedupeKeyForSoftware, normalizeSoftware } from './software.js'

/** The five standard SAM columns, with the header spellings accepted for each. */
export const SAM_COLUMNS = [
  {
    key: 'name',
    label: 'Software Name',
    required: true,
    aliases: ['software name', 'software', 'name', 'product name', 'application name', 'software title'],
  },
  {
    key: 'vendorName',
    label: 'Software Vendor',
    required: false,
    aliases: ['software vendor', 'vendor', 'vendor name', 'publisher', 'software publisher', 'manufacturer'],
  },
  {
    key: 'softwareStatus',
    label: 'Software Status',
    required: false,
    aliases: ['software status', 'status', 'licence status', 'license status', 'state'],
  },
  {
    key: 'purchasedDate',
    label: 'Purchase Date',
    required: true,
    aliases: ['purchase date', 'purchased date', 'purchase dt', 'purchase', 'procurement date', 'date of purchase'],
  },
  {
    key: 'expiryDate',
    label: 'Expire Date',
    required: true,
    aliases: ['expire date', 'expiry date', 'expiration date', 'expires on', 'expire', 'expiry', 'valid till', 'valid until', 'end date'],
  },
]

export const SAM_ACCEPTED_EXTENSIONS = ['.xlsx', '.xls']
export const SAM_TEMPLATE_HEADERS = SAM_COLUMNS.map((column) => column.label)

const MAX_ROWS = 20000

export function isAcceptedSamFile(name = '') {
  return SAM_ACCEPTED_EXTENSIONS.some((ext) => String(name).toLowerCase().endsWith(ext))
}

/** Case-insensitive, whitespace-insensitive header key. */
const headerKey = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')

const ALIAS_INDEX = new Map()
SAM_COLUMNS.forEach((column) => {
  ;[column.label, ...column.aliases].forEach((alias) => {
    ALIAS_INDEX.set(headerKey(alias), column.key)
  })
})

export function matchSamHeader(value) {
  return ALIAS_INDEX.get(headerKey(value)) || null
}

/** Reads every worksheet into plain matrices so the best SAM sheet can be chosen. */
export function parseSamWorkbook(buffer, fileName = '') {
  let workbook
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  } catch {
    throw new HttpError(422, `“${fileName || 'This file'}” is not a readable Excel workbook. Upload an .xlsx or .xls file.`)
  }
  if (!workbook.SheetNames.length) throw new HttpError(422, 'The workbook has no worksheets')

  return workbook.SheetNames.map((name) => ({
    name,
    matrix: XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: true, defval: '', blankrows: false }),
  }))
}

function cleanHeaders(row = []) {
  const seen = new Map()
  return row.map((cell, index) => {
    let label = String(cell ?? '').replace(/\s+/g, ' ').trim()
    if (!label) label = `Column ${index + 1}`
    const count = seen.get(label.toLowerCase()) || 0
    seen.set(label.toLowerCase(), count + 1)
    return count ? `${label} (${count + 1})` : label
  })
}

/** Locates the header row that matches the most standard columns. */
function structureFor(matrix) {
  const entries = matrix
    .map((row, index) => ({ row, index }))
    .filter((entry) => entry.row.some((cell) => String(cell ?? '').trim() !== ''))
  if (!entries.length) return null

  let best = { position: 0, mapping: {}, matches: -1, duplicates: [] }
  entries.slice(0, 10).forEach((entry, position) => {
    const mapping = {}
    const duplicates = []
    entry.row.forEach((cell, columnIndex) => {
      const key = matchSamHeader(cell)
      if (!key) return
      if (mapping[key] === undefined) mapping[key] = columnIndex
      else duplicates.push({ key, column: String(cell).trim(), index: columnIndex })
    })
    const matches = Object.keys(mapping).length
    if (matches > best.matches) best = { position, mapping, matches, duplicates }
  })

  const headers = cleanHeaders(entries[best.position].row || [])
  const mapping = best.position === 0 && best.matches < 1 ? {} : best.mapping
  const rows = entries.slice(best.position + 1).map((entry) => ({
    rowNumber: entry.index + 1,
    cells: headers.map((_, index) => entry.row[index] ?? ''),
    rawCells: entry.row.slice(),
  }))

  return { headers, mapping, duplicates: best.duplicates, rows }
}

/** Picks the worksheet with the most (and at least one) recognisable SAM columns. */
export function findSamSheet(sheets) {
  const candidates = []
  for (const sheet of sheets) {
    if (!sheet.matrix.length) continue
    const structure = structureFor(sheet.matrix)
    if (!structure) continue
    candidates.push({ sheetName: sheet.name, structure })
  }
  if (!candidates.length) throw new HttpError(422, 'The workbook has no rows to read')

  candidates.sort(
    (a, b) => Object.keys(b.structure.mapping).length - Object.keys(a.structure.mapping).length,
  )
  const best = candidates[0]
  if (!Object.keys(best.structure.mapping).length) {
    throw new HttpError(
      422,
      `No SAM columns were recognised. Expected headings: ${SAM_TEMPLATE_HEADERS.join(', ')}.`,
    )
  }
  return best
}

const rawCell = (value) => {
  if (value === '' || value == null) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : isoDate(value.getFullYear(), value.getMonth() + 1, value.getDate())
  return value
}

/** Original cell values keyed by the header text, so nothing imported is lost. */
function rawRowFor(structure, row) {
  return Object.fromEntries(
    structure.headers.map((header, index) => [header, rawCell(row.cells[index])]),
  )
}

/**
 * Validates every row with the same rules the manual form uses, then flags
 * duplicates both inside the file and against stored records.
 */
export function analyseSamSheet({ sheets, fileName, existingKeys = new Set() }) {
  const { sheetName, structure } = findSamSheet(sheets)
  const { headers, mapping, duplicates: duplicateColumns, rows } = structure

  const detected = SAM_COLUMNS.map((column) => ({
    key: column.key,
    label: column.label,
    required: column.required,
    header: mapping[column.key] === undefined ? null : headers[mapping[column.key]],
  }))
  const missingColumns = SAM_COLUMNS.filter((column) => column.required && mapping[column.key] === undefined).map(
    (column) => column.label,
  )
  const unrecognisedColumns = headers.filter((header, index) => {
    if (/^Column \d+$/.test(header)) return false
    return !Object.values(mapping).includes(index)
  })

  const seenInFile = new Set()
  const previewRows = []
  let invalid = 0
  let duplicates = 0

  rows.slice(0, MAX_ROWS).forEach((row) => {
    const input = Object.fromEntries(
      SAM_COLUMNS.map((column) => [
        column.key,
        mapping[column.key] === undefined ? null : row.cells[mapping[column.key]],
      ]),
    )
    const { record, errors } = normalizeSoftware(input)
    const list = Object.values(errors)
    const warn = []
    if (!String(input.softwareStatus ?? '').trim()) warn.push('Software Status was blank; saved as “Active”')

    let duplicate = null
    if (!list.length) {
      const key = record.dedupeKey || dedupeKeyForSoftware(record)
      if (existingKeys.has(key)) duplicate = 'database'
      else if (seenInFile.has(key)) duplicate = 'file'
      if (duplicate) duplicates += 1
      else seenInFile.add(key)
    }

    if (list.length) invalid += 1
    previewRows.push({
      rowNumber: row.rowNumber,
      values: {
        name: record.name,
        vendorName: record.vendorName,
        softwareStatus: record.softwareStatus,
        purchasedDate: record.purchasedDate,
        expiryDate: record.expiryDate,
      },
      raw: rawRowFor(structure, row),
      valid: !list.length,
      errors: list,
      warnings: warn,
      duplicate,
    })
  })

  const total = rows.length
  const beyondLimit = total > MAX_ROWS
  const counted = previewRows.length
  const ready = previewRows.filter((row) => row.valid && !row.duplicate).length

  return {
    fileName,
    sheetName,
    headers,
    detectedColumns: detected,
    mappedColumns: detected.filter((column) => column.header).length,
    missingColumns,
    unrecognisedColumns,
    duplicateColumns: duplicateColumns.map((entry) => entry.column),
    rows: previewRows,
    truncated: beyondLimit,
    summary: {
      total,
      counted,
      ready,
      valid: ready,
      invalid,
      duplicates,
      invalidOrDuplicate: invalid + duplicates,
    },
  }
}

/** Builds the downloadable five-column SAM template. */
export function buildSamTemplate() {
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet([SAM_TEMPLATE_HEADERS])
  sheet['!cols'] = SAM_TEMPLATE_HEADERS.map((header) => ({ wch: Math.max(18, header.length + 4) }))
  XLSX.utils.book_append_sheet(workbook, sheet, 'SAM')

  const guide = XLSX.utils.aoa_to_sheet([
    ['SAM Excel Template'],
    [],
    ['Column', 'Required', 'Format / notes'],
    ['Software Name', 'Yes', 'Name of the software or application'],
    ['Software Vendor', 'No', 'Publisher or supplier name'],
    ['Software Status', 'No', 'Free text; Active, Inactive, Suspended or Retired are recognised'],
    ['Purchase Date', 'Yes', 'DD-MM-YYYY, YYYY-MM-DD or an Excel date cell'],
    ['Expire Date', 'Yes', 'DD-MM-YYYY, YYYY-MM-DD or an Excel date cell'],
    [],
    ['Header matching ignores case and extra spaces. Existing records are never overwritten.'],
  ])
  guide['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 70 }]
  XLSX.utils.book_append_sheet(workbook, guide, 'Instructions')

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
}

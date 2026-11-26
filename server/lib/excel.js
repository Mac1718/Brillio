import * as XLSX from 'xlsx'
import { detectSheetStructure } from '../../src/lib/excel.js'
import {
  ASSET_FIELDS,
  MAINTENANCE_FIELDS,
  STANDARD_ASSESSMENT_KEYS,
  TICKET_FIELDS,
  detectMapping,
  fieldLabel,
  mappedFieldCount,
  normalizeHeader,
} from '../../src/lib/fields.js'
import { HttpError } from './http.js'
import { normalizeAssessment } from './validate.js'

export const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv']

const MAX_SHEET_ROWS = 50000

export function isAcceptedFileName(name = '') {
  return ACCEPTED_EXTENSIONS.some((ext) => String(name).toLowerCase().endsWith(ext))
}

/** Reads a workbook buffer into plain matrices, with real Date cells. */
export function parseWorkbook(buffer, fileName = '') {
  let workbook
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  } catch {
    throw new HttpError(422, `“${fileName || 'This file'}” is not a readable Excel or CSV workbook`)
  }
  if (!workbook.SheetNames.length) throw new HttpError(422, 'The workbook has no worksheets')

  const sheets = workbook.SheetNames.map((name) => ({
    name,
    matrix: XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: true, defval: '', blankrows: false }),
  }))

  return sheets
}

/** Picks the asset sheet: the one whose headers map to the most asset fields. */
function findAssetSheet(sheets) {
  const candidates = []
  for (const sheet of sheets) {
    if (!sheet.matrix.length) continue
    const structure = detectSheetStructure(sheet.matrix, ASSET_FIELDS)
    if (!structure) continue
    candidates.push({ sheetName: sheet.name, structure, mapped: mappedFieldCount(structure.mapping) })
  }
  if (!candidates.length) throw new HttpError(422, 'No worksheet with readable columns was found')
  candidates.sort((a, b) => b.mapped - a.mapped)
  const best = candidates[0]
  if (best.mapped === 0) {
    throw new HttpError(422, 'No recognisable asset columns were found. Expected headings such as Asset ID, Serial Number or PO Date.')
  }
  return best
}

function detectExtras(sheets, mainSheetName) {
  const extras = { tickets: null, maintenance: null }
  for (const sheet of sheets) {
    if (sheet.name === mainSheetName) continue
    if (!sheet.matrix.length) continue

    if (!extras.tickets) {
      const structure = detectSheetStructure(sheet.matrix, TICKET_FIELDS)
      if (structure && mappedFieldCount(structure.mapping) >= 3) {
        const mapping = structure.mapping
        const identity = mapping.ticketId != null || mapping.subject != null
        const timing = mapping.opened != null || mapping.resolved != null || mapping.resolutionHours != null
        const keywords = structure.headers.some((h) => /(ticket|issue|incident|case|helpdesk)/i.test(String(h)))
        if (identity && (timing || keywords)) {
          extras.tickets = { sheetName: sheet.name, headers: structure.headers, mapping, rows: structure.rows }
          continue
        }
      }
    }

    if (!extras.maintenance) {
      const structure = detectSheetStructure(sheet.matrix, MAINTENANCE_FIELDS)
      if (structure && mappedFieldCount(structure.mapping) >= 3) {
        const mapping = structure.mapping
        const operational = mapping.date != null || mapping.cost != null || mapping.status != null
        const identity = mapping.workOrder != null || mapping.assetRef != null || mapping.assetName != null
        const keywords = structure.headers.some((h) => /(mainten|repair|service|work order|fault)/i.test(String(h)))
        if (operational && identity && (keywords || mapping.workOrder != null)) {
          extras.maintenance = { sheetName: sheet.name, headers: structure.headers, mapping, rows: structure.rows }
        }
      }
    }
  }
  return extras
}

function coerceMapping(mapping, headers, overrides = {}) {
  const next = { ...mapping }
  const applied = []
  for (const [key, value] of Object.entries(overrides || {})) {
    if (!ASSET_FIELDS.some((field) => field.key === key)) continue
    if (value === null || value === '' || value === -1) {
      delete next[key]
      continue
    }
    const index = Number(value)
    if (!Number.isInteger(index) || index < 0 || index >= headers.length) continue
    for (const [existingKey, existingIndex] of Object.entries(next)) {
      if (existingIndex === index && existingKey !== key) delete next[existingKey]
    }
    next[key] = index
    applied.push(key)
  }
  return { mapping: next, applied }
}

const valueAt = (cells, mapping, key) => (mapping[key] == null ? '' : cells[mapping[key]])

function inputFromCells(cells, mapping, extras = {}) {
  return {
    assetId: valueAt(cells, mapping, 'assetId'),
    serial: valueAt(cells, mapping, 'serial'),
    name: valueAt(cells, mapping, 'name'),
    category: valueAt(cells, mapping, 'category'),
    brand: valueAt(cells, mapping, 'brand'),
    model: valueAt(cells, mapping, 'model'),
    quantity: valueAt(cells, mapping, 'quantity'),
    employee: valueAt(cells, mapping, 'employee'),
    department: valueAt(cells, mapping, 'department'),
    location: valueAt(cells, mapping, 'location'),
    assetStatus: valueAt(cells, mapping, 'status'),
    purchaseDate: valueAt(cells, mapping, 'purchaseDate'),
    price: valueAt(cells, mapping, 'price'),
    currentValue: valueAt(cells, mapping, 'currentValue'),
    warrantyStart: valueAt(cells, mapping, 'warrantyStart'),
    warrantyEnd: valueAt(cells, mapping, 'warrantyEnd'),
    storage: valueAt(cells, mapping, 'storage'),
    storageType: valueAt(cells, mapping, 'storageType'),
    ram: valueAt(cells, mapping, 'ram'),
    processor: valueAt(cells, mapping, 'processor'),
    os: valueAt(cells, mapping, 'os'),
    vendorName: valueAt(cells, mapping, 'supplier') || extras.vendorName || '',
    assessmentStatus: valueAt(cells, mapping, 'assessmentStatus'),
    notes: valueAt(cells, mapping, 'notes'),
    costType: valueAt(cells, mapping, 'costType'),
    projectId: valueAt(cells, mapping, 'projectId'),
    projectName: valueAt(cells, mapping, 'projectName'),
    memo: valueAt(cells, mapping, 'memo'),
    bau: valueAt(cells, mapping, 'bau'),
    remarks: valueAt(cells, mapping, 'remarks'),
    costQ1: valueAt(cells, mapping, 'costQ1'),
    costQ2: valueAt(cells, mapping, 'costQ2'),
    costQ3: valueAt(cells, mapping, 'costQ3'),
    costQ4: valueAt(cells, mapping, 'costQ4'),
    totalBudgetFy: valueAt(cells, mapping, 'totalBudgetFy'),
    spendFy: valueAt(cells, mapping, 'spendFy'),
    savings: valueAt(cells, mapping, 'savings'),
    excess: valueAt(cells, mapping, 'excess'),
    po: valueAt(cells, mapping, 'po'),
    poDate: valueAt(cells, mapping, 'poDate'),
    pr: valueAt(cells, mapping, 'pr'),
    prDate: valueAt(cells, mapping, 'prDate'),
  }
}

/**
 * Header matching is case-insensitive and whitespace-insensitive everywhere
 * (normalizeHeader lowercases and strips separators), so "Cost Q1", "COST Q1"
 * and " cost  q1 " all resolve to the same field. Two columns that normalise to
 * the same thing are therefore genuine duplicates and worth flagging.
 */
function detectDuplicateHeaders(headers) {
  const byNormalized = new Map()
  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header)
    if (!normalized) return
    if (!byNormalized.has(normalized)) byNormalized.set(normalized, [])
    byNormalized.get(normalized).push({ index, header: String(header).trim() })
  })
  const exact = [...byNormalized.entries()]
    .filter(([, columns]) => columns.length > 1)
    .map(([normalized, columns]) => ({ normalized, columns: columns.map((column) => column.header) }))

  const fieldColumns = new Map()
  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header)
    if (!normalized) return
    ASSET_FIELDS.forEach((field) => {
      if (!field.synonyms.some((synonym) => normalizeHeader(synonym) === normalized)) return
      if (!fieldColumns.has(field.key)) fieldColumns.set(field.key, [])
      fieldColumns.get(field.key).push({ index, header: String(header).trim() })
    })
  })
  const fields = [...fieldColumns.entries()]
    .filter(([, columns]) => columns.length > 1)
    .map(([key, columns]) => ({ field: key, label: fieldLabel(key), columns: columns.map((column) => column.header) }))

  return { exact, fields }
}

/**
 * Parses + validates every row of the asset sheet. No record is written here;
 * this powers the preview and is re-run when the import is committed.
 */
export function analyseWorkbook(buffer, { fileName = '', overrides = {} } = {}) {
  const sheets = parseWorkbook(buffer, fileName)
  const { sheetName, structure } = findAssetSheet(sheets)
  const { mapping, applied } = coerceMapping(structure.mapping, structure.headers, overrides)
  const extras = detectExtras(sheets, sheetName)

  if (structure.rows.length > MAX_SHEET_ROWS) {
    throw new HttpError(413, `This sheet has ${structure.rows.length} rows; the limit is ${MAX_SHEET_ROWS}. Split the file and import in parts.`)
  }

  const mappedKeys = Object.keys(mapping).filter((key) => mapping[key] != null)
  const missingMandatory = []
  const hasIdentity = ['assetId', 'serial', 'projectId', 'memo'].some((key) => mappedKeys.includes(key))
  if (!hasIdentity) missingMandatory.push('Asset ID, Serial Number, Project ID or Memo header/Description column')
  // Year/quarter are derived from PO Date, so the column is mandatory.
  if (mapping.poDate == null) missingMandatory.push('PO Date column')

  const duplicates = detectDuplicateHeaders(structure.headers)
  const standard = {
    total: STANDARD_ASSESSMENT_KEYS.length,
    matched: STANDARD_ASSESSMENT_KEYS.filter((key) => mapping[key] != null).map((key) => ({ key, label: fieldLabel(key) })),
    missing: STANDARD_ASSESSMENT_KEYS.filter((key) => mapping[key] == null).map((key) => ({ key, label: fieldLabel(key) })),
  }
  standard.matchedCount = standard.matched.length
  standard.isStandardTemplate = standard.matchedCount >= 5

  const usedColumns = new Set(Object.values(mapping))
  const duplicateColumnNames = new Set(duplicates.exact.flatMap((entry) => entry.columns))
  const unrecognised = structure.headers.filter((header, index) => {
    if (String(header).trim() === '') return false
    if (usedColumns.has(index)) return false
    if (duplicateColumnNames.has(String(header).trim())) return false
    return true
  })

  const rows = []
  const seenKeys = new Set()
  const vendorNames = new Set()
  const vendorNameCounts = new Map()
  let missingVendorName = 0

  structure.rows.forEach((row) => {
    const cells = row.cells
    const input = inputFromCells(cells, mapping)
    const result = normalizeAssessment(input, { source: 'excel' })
    const dupes = []
    if (result.record.dedupeKey) {
      if (seenKeys.has(result.record.dedupeKey)) dupes.push('Duplicate of an earlier row in this file')
      seenKeys.add(result.record.dedupeKey)
    }
    if (result.record.vendorName) {
      vendorNames.add(result.record.vendorName)
      vendorNameCounts.set(result.record.vendorName, (vendorNameCounts.get(result.record.vendorName) || 0) + 1)
    } else {
      missingVendorName += 1
    }
    if (result.errors.length === 0 && dupes.length) {
      result.errors.push(...dupes)
      result.valid = false
    }

    rows.push({
      rowNumber: row.__row,
      record: result.record,
      errors: result.errors,
      warnings: result.warnings,
      valid: result.valid,
      raw: cells,
    })
  })

  return {
    fileName,
    sheetName,
    sheetNames: sheets.map((sheet) => sheet.name),
    headers: structure.headers,
    mapping,
    overridesApplied: applied,
    missingMandatory,
    standard,
    duplicates,
    unrecognised,
    extras,
    rows,
    vendorNames: [...vendorNames],
    vendorNameCounts: [...vendorNameCounts.entries()].map(([name, count]) => ({ name, count })),
    missingVendorName,
  }
}

export function summarise(rows, existingKeys = new Set()) {
  let valid = 0
  let invalid = 0
  let duplicates = 0
  rows.forEach((row) => {
    if (!row.valid) {
      invalid += 1
      return
    }
    if (existingKeys.has(row.record.dedupeKey)) {
      duplicates += 1
      row.duplicate = true
      return
    }
    valid += 1
  })
  return { total: rows.length, valid, invalid, duplicates }
}

/** Payload for the browser: summary + a capped sample of rows. */
export function toPreviewPayload(analysis, existingKeys, { limit = 200 } = {}) {
  const summary = summarise(analysis.rows, existingKeys)
  const sample = analysis.rows.slice(0, limit).map((row) => ({
    rowNumber: row.rowNumber,
    valid: row.valid,
    duplicate: Boolean(row.duplicate),
    errors: row.errors,
    warnings: row.warnings,
    record: {
      assetId: row.record.assetId,
      serial: row.record.serial,
      name: row.record.name,
      category: row.record.category,
      department: row.record.department,
      location: row.record.location,
      vendorName: row.record.vendorName,
      assessmentYear: row.record.assessmentYear,
      assessmentQuarter: row.record.assessmentQuarter,
      assessmentStatus: row.record.assessmentStatus,
      price: row.record.price,
      quantity: row.record.quantity,
      costType: row.record.costType,
      projectId: row.record.projectId,
      projectName: row.record.projectName,
      memo: row.record.memo,
      bau: row.record.bau,
      remarks: row.record.remarks,
      costQ1: row.record.costQ1,
      costQ2: row.record.costQ2,
      costQ3: row.record.costQ3,
      costQ4: row.record.costQ4,
      totalBudgetFy: row.record.totalBudgetFy,
      spendFy: row.record.spendFy,
      savings: row.record.savings,
      excess: row.record.excess,
      po: row.record.po,
      poDate: row.record.poDate,
      pr: row.record.pr,
      prDate: row.record.prDate,
    },
  }))

  return {
    fileName: analysis.fileName,
    sheetName: analysis.sheetName,
    sheetNames: analysis.sheetNames,
    headers: analysis.headers,
    mapping: analysis.mapping,
    mappedFields: Object.keys(analysis.mapping).filter((key) => analysis.mapping[key] != null),
    missingMandatory: analysis.missingMandatory,
    poDateColumn: analysis.mapping.poDate ?? null,
    standard: analysis.standard,
    duplicates: analysis.duplicates,
    unrecognised: analysis.unrecognised,
    supportingSheets: {
      tickets: analysis.extras.tickets?.sheetName || null,
      maintenance: analysis.extras.maintenance?.sheetName || null,
    },
    summary,
    truncated: analysis.rows.length > limit,
    rows: sample,
  }
}

export function extractVendorNames(analysis) {
  return analysis.vendorNames || []
}

export { detectMapping }

import { ASSET_FIELDS } from './fields.js'
import { canonicalCategory, canonicalStatus, parseStorage } from './normalize.js'

/** ISO date (YYYY-MM-DD) -> local Date without timezone drift. */
export function isoToDate(value) {
  if (!value) return null
  const match = String(value).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

const numeric = (value) => (value == null || value === '' || Number.isNaN(Number(value)) ? null : Number(value))

/** Maps a database assessment record onto the asset shape the dashboard uses. */
export function recordToAsset(record, index = 0) {
  const units = numeric(record.quantity) > 0 ? Math.max(1, Math.round(numeric(record.quantity))) : 1
  const name =
    record.name ||
    [record.brand, record.model].filter(Boolean).join(' ') ||
    record.category ||
    'Unnamed asset'

  return {
    uid: record.id || index,
    id: record.id,
    assetId: record.assetId || record.serial || `#${index + 1}`,
    serial: record.serial || '',
    name,
    category: canonicalCategory(record.category),
    categoryRaw: record.category || '',
    brand: record.brand || '',
    model: record.model || '',
    purchaseDate: isoToDate(record.purchaseDate),
    price: numeric(record.price),
    quantity: numeric(record.quantity),
    units,
    currentValue: numeric(record.currentValue),
    valueDerived: false,
    employee: record.employee || '',
    department: record.department || '',
    location: record.location || '',
    status: record.assetStatus || canonicalStatus('', record.employee),
    statusRaw: record.assetStatus || '',
    warrantyStart: isoToDate(record.warrantyStart),
    warrantyEnd: isoToDate(record.warrantyEnd),
    storage: parseStorage(record.storage),
    storageType: record.storageType || '',
    ram: parseStorage(record.ram),
    processor: record.processor || '',
    os: record.os || '',
    supplier: record.vendorName || '',
    lastMaintenance: null,
    maintenanceCost: null,
    repairStatus: '',
    notes: record.notes || '',
    assessmentDate: isoToDate(record.assessmentDate),
    assessmentYear: numeric(record.assessmentYear),
    assessmentQuarter: record.assessmentQuarter || null,
    assessmentStatus: record.assessmentStatus || null,
    vendorId: record.vendorId || null,
    vendorName: record.vendorName || '',
    vendorCity: record.vendorCity || '',
    vendorState: record.vendorState || '',
    source: record.source || 'manual',
    raw: record,
  }
}

const RECORD_KEY = {
  assetId: 'assetId',
  serial: 'serial',
  name: 'name',
  category: 'category',
  brand: 'brand',
  model: 'model',
  quantity: 'quantity',
  employee: 'employee',
  department: 'department',
  location: 'location',
  status: 'assetStatus',
  purchaseDate: 'purchaseDate',
  price: 'price',
  currentValue: 'currentValue',
  warrantyStart: 'warrantyStart',
  warrantyEnd: 'warrantyEnd',
  storage: 'storage',
  storageType: 'storageType',
  ram: 'ram',
  processor: 'processor',
  os: 'os',
  supplier: 'vendorName',
  assessmentDate: 'assessmentDate',
  assessmentStatus: 'assessmentStatus',
  notes: 'notes',
}

/**
 * The dashboard pages were written against an imported-workbook object. This
 * rebuilds that shape from database records so existing pages keep working
 * while `hasField()` still reflects which fields actually contain data.
 */
export function datasetFromRecords(records, meta = {}, extras = {}) {
  const mapping = {}
  ASSET_FIELDS.forEach((field, index) => {
    const source = RECORD_KEY[field.key]
    if (!source) return
    if (records.some((record) => record[source] != null && record[source] !== '')) mapping[field.key] = index
  })

  const headers = ASSET_FIELDS.map((field) => field.label)
  const rows = records.map((record) =>
    ASSET_FIELDS.map((field) => {
      const source = RECORD_KEY[field.key]
      return source ? record[source] ?? '' : ''
    }),
  )

  return {
    fileName: meta.fileName || 'Assessment database',
    fileSize: meta.fileSize || 0,
    sheetName: meta.sheetName || 'Assessments',
    sheetNames: meta.sheetNames || ['Assessments'],
    headers,
    rows,
    mapping,
    headerRowIndex: 0,
    dateOrder: 'dmy',
    importedAt: meta.importedAt || new Date().toISOString(),
    tickets: extras.tickets || null,
    maintenance: extras.maintenance || null,
    recordCount: records.length,
  }
}

export const assessmentBadgeTone = (status) => {
  if (status === 'Completed') return 'green'
  if (status === 'In Progress') return 'amber'
  if (status === 'Cancelled') return 'neutral'
  return 'blue'
}

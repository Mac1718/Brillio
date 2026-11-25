import crypto from 'node:crypto'

export const ASSESSMENT_STATUSES = ['Pending', 'In Progress', 'Completed', 'Cancelled']
export const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']

const pad = (value) => String(value).padStart(2, '0')

export const isoDate = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`

function validParts(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (year < 1900 || year > 2999) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const check = new Date(Date.UTC(year, month - 1, day))
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null
  return { year, month, day }
}

function fromSerial(serial) {
  // Excel epoch is 1899-12-30 once the 1900 leap-year bug is accounted for.
  const utc = Math.round((serial - 25569) * 86400000)
  const date = new Date(utc)
  if (Number.isNaN(date.getTime())) return null
  return validParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

/**
 * Parses every date representation an Excel register realistically contains:
 * Date cells, Excel serial numbers, ISO, and day-first / month-first text.
 * Ambiguous numeric dates are read day-first (en-GB), matching the importer.
 */
export function parseAssessmentDate(value) {
  if (value == null || value === '') return null

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return validParts(value.getFullYear(), value.getMonth() + 1, value.getDate())
  }

  if (typeof value === 'number') {
    if (value >= 20000 && value < 80000) return fromSerial(value)
    if (value >= 1900 && value <= 2999) return validParts(Math.trunc(value), 1, 1)
    return null
  }

  const text = String(value).trim()
  if (!text) return null

  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ].*)?$/)
  if (match) return validParts(Number(match[1]), Number(match[2]), Number(match[3]))

  match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/)
  if (match) {
    let year = Number(match[3])
    if (year < 100) year += year > 70 ? 1900 : 2000
    return validParts(year, Number(match[2]), Number(match[1]))
  }

  match = text.match(/^(\d{1,2})[- ]([A-Za-z]{3,9})[- ](\d{2,4})$/)
  if (match) {
    const year = match[3].length === 2 ? Number(match[3]) + (Number(match[3]) > 70 ? 1900 : 2000) : Number(match[3])
    const month = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(match[2].slice(0, 3).toLowerCase()) + 1
    if (month) return validParts(year, month, Number(match[1]))
  }

  const fallback = new Date(text)
  if (Number.isNaN(fallback.getTime())) return null
  return validParts(fallback.getFullYear(), fallback.getMonth() + 1, fallback.getDate())
}

/** Month 1-12 -> quarter label. This is the single source of truth for classification. */
export const quarterForMonth = (month) => QUARTERS[Math.floor((month - 1) / 3)]

export function quarterBounds(year, quarter) {
  const index = QUARTERS.indexOf(quarter)
  if (index < 0) return null
  const startMonth = index * 3 + 1
  const endMonth = startMonth + 2
  const lastDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate()
  return { start: isoDate(year, startMonth, 1), end: isoDate(year, endMonth, lastDay) }
}

export function classifyAssessmentDate(value) {
  const parts = parseAssessmentDate(value)
  if (!parts) {
    return {
      error: value == null || value === '' ? 'Assessment date is required' : `“${String(value).slice(0, 40)}” is not a valid date`,
    }
  }
  return {
    iso: isoDate(parts.year, parts.month, parts.day),
    year: parts.year,
    quarter: quarterForMonth(parts.month),
    month: parts.month,
  }
}

export function canonicalAssessmentStatus(raw) {
  const text = String(raw ?? '').toLowerCase().trim()
  if (!text) return null
  if (/(cancel|void|abandon|not applicable|n\/a|skip)/.test(text)) return 'Cancelled'
  if (/(complet|done|resolv|clos|finish|verified|approved|pass)/.test(text)) return 'Completed'
  if (/(progress|ongoing|review|pending review|in ?process|started|scheduled|assigned)/.test(text)) return 'In Progress'
  if (/(pend|open|await|hold|not started|new)/.test(text)) return 'Pending'
  return null
}

export function canonicalAssetStatus(raw, employee) {
  const text = String(raw ?? '').toLowerCase().trim()
  if (text) {
    if (/(retire|dispos|scrap|written off|end of life|\beol\b)/.test(text)) return 'Retired'
    if (/(damag|broken|faulty|defect|not working|dead|out of order)/.test(text)) return 'Damaged'
    if (/(maintenance|under repair|repair|service|diagnos|rma)/.test(text)) return 'Maintenance'
    if (/(available|in stock|spare|unassigned|idle|free|ready|in store)/.test(text)) return 'Available'
    if (/(assign|in use|in-use|issued|allocated|deployed|active|working)/.test(text)) return 'Assigned'
    return 'Other'
  }
  return String(employee ?? '').trim() ? 'Assigned' : 'Available'
}

const cleanText = (value, max = 500) => {
  if (value == null) return null
  const text = String(value).replace(/\s+/g, ' ').trim()
  if (!text) return null
  return text.length > max ? text.slice(0, max) : text
}

export function parseNumber(value) {
  if (value == null || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const text = String(value).trim()
  if (!text) return null
  const negative = /^\(.*\)$/.test(text)
  let cleaned = text.replace(/[^0-9.,-]/g, '')
  if (!cleaned || !/\d/.test(cleaned)) return null
  if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
      ? cleaned.replace(/\./g, '').replace(/,/g, '.')
      : cleaned.replace(/,/g, '')
  } else if (cleaned.includes(',')) {
    const grouped = /^-?\d{1,3}(,\d{3})+$/.test(cleaned)
    cleaned = grouped ? cleaned.replace(/,/g, '') : cleaned.replace(/,/g, '.')
  }
  const number = Number(cleaned)
  if (!Number.isFinite(number)) return null
  return negative ? -number : number
}

const optionalIso = (value) => {
  const parts = parseAssessmentDate(value)
  return parts ? isoDate(parts.year, parts.month, parts.day) : null
}

export const dedupeKeyFor = ({ assetId, serial, assessmentDate }) =>
  crypto
    .createHash('sha256')
    .update([assetId || '', serial || '', assessmentDate || ''].join('|').toLowerCase())
    .digest('hex')

/**
 * Normalises one assessment from either Excel or manual entry. Both paths call
 * this function, so validation and date/quarter rules cannot drift apart.
 */
export function normalizeAssessment(input, { source = 'manual' } = {}) {
  const errors = []
  const warnings = []

  const assetId = cleanText(input.assetId, 120)
  const serial = cleanText(input.serial, 160)
  if (!assetId && !serial) errors.push('Asset ID or Serial Number is required')

  const date = classifyAssessmentDate(input.assessmentDate)
  if (date.error) errors.push(date.error)

  const quantityRaw = input.quantity
  let quantity = parseNumber(quantityRaw)
  if (quantity != null && quantity < 1) {
    errors.push('Quantity must be 1 or more')
  }
  if (quantity == null) quantity = 1
  quantity = Math.max(1, Math.round(quantity))

  const price = parseNumber(input.price)
  const currentValue = parseNumber(input.currentValue)
  if (input.price != null && String(input.price).trim() !== '' && price == null) warnings.push('Purchase price is not numeric and was ignored')
  if (input.currentValue != null && String(input.currentValue).trim() !== '' && currentValue == null) warnings.push('Current value is not numeric and was ignored')

  const statusRaw = input.assessmentStatus
  let assessmentStatus = canonicalAssessmentStatus(statusRaw)
  if (!assessmentStatus) {
    if (cleanText(statusRaw)) warnings.push(`Unrecognised assessment status “${cleanText(statusRaw, 40)}” treated as Pending`)
    assessmentStatus = 'Pending'
  }

  const record = {
    assetId,
    serial,
    name: cleanText(input.name, 200),
    category: cleanText(input.category, 80),
    brand: cleanText(input.brand, 80),
    model: cleanText(input.model, 120),
    quantity,
    employee: cleanText(input.employee, 120),
    department: cleanText(input.department, 120),
    location: cleanText(input.location, 160),
    assetStatus: canonicalAssetStatus(input.assetStatus, input.employee),
    purchaseDate: optionalIso(input.purchaseDate),
    price,
    currentValue,
    warrantyStart: optionalIso(input.warrantyStart),
    warrantyEnd: optionalIso(input.warrantyEnd),
    storage: cleanText(input.storage, 60),
    storageType: cleanText(input.storageType, 40),
    ram: cleanText(input.ram, 60),
    processor: cleanText(input.processor, 120),
    os: cleanText(input.os, 80),
    vendorName: cleanText(input.vendorName, 160),
    assessmentDate: date.iso || null,
    assessmentYear: date.year || null,
    assessmentQuarter: date.quarter || null,
    assessmentStatus,
    notes: cleanText(input.notes, 2000),
    source,
    issues: [...errors, ...warnings],
  }

  record.dedupeKey = record.assetId || record.serial
    ? dedupeKeyFor({ assetId: record.assetId, serial: record.serial, assessmentDate: record.assessmentDate || '' })
    : null

  return { record, errors, warnings, valid: errors.length === 0 }
}

export function validateUser({ name, email, password, role }, { partial = false } = {}) {
  const errors = {}
  if (!partial || name !== undefined) {
    if (!cleanText(name)) errors.name = 'Name is required'
  }
  if (!partial || email !== undefined) {
    const value = String(email || '').trim().toLowerCase()
    if (!value) errors.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) errors.email = 'Enter a valid email address'
  }
  if (!partial || password !== undefined) {
    const value = String(password || '')
    if (!value) errors.password = 'Password is required'
    else if (value.length < 8) errors.password = 'Use at least 8 characters'
    else if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) errors.password = 'Include at least one letter and one number'
  }
  if (!partial || role !== undefined) {
    if (role !== undefined && !['admin', 'manager', 'user'].includes(role)) errors.role = 'Choose a valid role'
  }
  return errors
}

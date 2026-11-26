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
    // SheetJS turns a date-formatted cell into a Date a few seconds before
    // local midnight of the previous day. That is still the intended calendar
    // day, so snap values in the last minute of a day forward.
    let day = value
    const midnight = new Date(value.getFullYear(), value.getMonth(), value.getDate())
    if (value.getTime() - midnight.getTime() >= 86340000) {
      day = new Date(value.getFullYear(), value.getMonth(), value.getDate() + 1)
    }
    return validParts(day.getFullYear(), day.getMonth() + 1, day.getDate())
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

/** Month 1-12 -> quarter label. Single source of truth for classification. */
export const quarterForMonth = (month) => QUARTERS[Math.floor((month - 1) / 3)]

export function quarterBounds(year, quarter) {
  const index = QUARTERS.indexOf(quarter)
  if (index < 0) return null
  const startMonth = index * 3 + 1
  const endMonth = startMonth + 2
  const lastDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate()
  return { start: isoDate(year, startMonth, 1), end: isoDate(year, endMonth, lastDay) }
}

/**
 * PO Date is the single source of truth for the reporting financial year and
 * quarter. It is mandatory: a missing or unreadable PO Date is a validation
 * error, so a record is never given a guessed quarter.
 */
export function classifyPoDate(value) {
  const text = value == null ? '' : String(value).trim()
  if (!text) {
    return { error: 'PO Date is required: it determines the financial year and quarter' }
  }
  // A bare year would silently become January, i.e. Q1. Require a full date.
  if (/^\d{4}$/.test(text) || (typeof value === 'number' && value >= 1900 && value <= 2999)) {
    return { error: `PO Date “${text.slice(0, 40)}” needs a month and day, not just a year` }
  }
  const parts = parseAssessmentDate(value)
  if (!parts) {
    return { error: `PO Date “${text.slice(0, 40)}” is not a valid date, so its financial year and quarter cannot be determined` }
  }
  return {
    iso: isoDate(parts.year, parts.month, parts.day),
    year: parts.year,
    quarter: quarterForMonth(parts.month),
    month: parts.month,
  }
}

/** Reporting year/quarter from a stored ISO PO date; null when absent/invalid. */
export function classificationFromPoDate(value) {
  const parts = parseAssessmentDate(value)
  if (!parts) return null
  return { year: parts.year, quarter: quarterForMonth(parts.month), month: parts.month }
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

export const cleanText = (value, max = 500) => {
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

/**
 * Stable duplicate key.
 *
 * The register has no assessment date column, so an asset or project is
 * identified together with its PO Date, which is the reporting period.
 * Project-based rows get their own namespace so a project ID can never
 * collide with an asset ID.
 */
export const dedupeKeyFor = ({ assetId, serial, projectId, memo, poDate }) => {
  const hasAssetIdentity = Boolean(cleanText(assetId) || cleanText(serial))
  const identity = hasAssetIdentity
    ? `${assetId || ''}|${serial || ''}`
    : `${projectId || memo || ''}|~standard`
  return crypto.createHash('sha256').update(`${identity}|${poDate || ''}`.toLowerCase()).digest('hex')
}

/** Numeric standard field with a field-specific error message. */
function numberField(value, label, errors) {
  if (value == null || String(value).trim() === '') return null
  const parsed = parseNumber(value)
  if (parsed == null) {
    errors.push(`${label} must be a number (received “${String(value).trim().slice(0, 30)}”)`)
    return null
  }
  return parsed
}

/** Optional date field belonging to the standard template (PO / PR dates). */
function dateField(value, label, errors) {
  if (value == null || String(value).trim() === '') return null
  const parts = parseAssessmentDate(value)
  if (!parts) {
    errors.push(`${label} is not a valid date (received “${String(value).trim().slice(0, 30)}”)`)
    return null
  }
  return isoDate(parts.year, parts.month, parts.day)
}

/**
 * Normalises one assessment from either Excel or manual entry. Both paths call
 * this function, so validation and date/quarter rules cannot drift apart.
 */
export function normalizeAssessment(input, { source = 'manual' } = {}) {
  const errors = []
  const warnings = []

  const assetId = cleanText(input.assetId, 120)
  const serial = cleanText(input.serial, 160)
  const projectId = cleanText(input.projectId, 120)
  const memo = cleanText(input.memo, 400)

  if (!assetId && !serial && !projectId && !memo) {
    errors.push('Requires an Asset ID, Serial Number, Project ID or Memo header/Description')
  }

  // Financial year and quarter always come from the PO Date.
  const poDate = classifyPoDate(input.poDate)
  if (poDate.error) errors.push(poDate.error)

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
    assessmentYear: poDate.year || null,
    assessmentQuarter: poDate.quarter || null,
    assessmentStatus,
    notes: cleanText(input.notes, 2000),

    // ---- standard 21-column assessment structure ----
    costType: cleanText(input.costType, 120),
    projectId,
    projectName: cleanText(input.projectName, 200),
    memo,
    bau: cleanText(input.bau, 60),
    remarks: cleanText(input.remarks, 2000),
    costQ1: numberField(input.costQ1, 'Cost Q1', errors),
    costQ2: numberField(input.costQ2, 'Cost Q2', errors),
    costQ3: numberField(input.costQ3, 'Cost Q3', errors),
    costQ4: numberField(input.costQ4, 'Cost Q4', errors),
    totalBudgetFy: numberField(input.totalBudgetFy, 'Total Budget FY', errors),
    spendFy: numberField(input.spendFy, 'Spend FY', errors),
    savings: numberField(input.savings, 'Savings', errors),
    excess: numberField(input.excess, 'Excess', errors),
    // PO / PR stay text so leading zeros and alphanumerics survive.
    po: cleanText(input.po, 80),
    poDate: poDate.iso || null,
    pr: cleanText(input.pr, 80),
    prDate: dateField(input.prDate, 'PR Date', errors),

    source,
    issues: [...errors, ...warnings],
  }

  record.dedupeKey =
    record.assetId || record.serial || record.projectId || record.memo
      ? dedupeKeyFor({
          assetId: record.assetId,
          serial: record.serial,
          projectId: record.projectId,
          memo: record.memo,
          poDate: record.poDate || '',
        })
      : null

  return { record, errors, warnings, valid: errors.length === 0 }
}

export function validateUser({ name, email, password, role }, { partial = false } = {}) {
  const errors = {}
  // Display name is optional: the account is identified by its email and the
  // API derives a readable name when none is supplied.
  if (name !== undefined && name !== null && String(name).trim() !== '' && !cleanText(name)) {
    errors.name = 'Enter a valid name'
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
    if (!role) errors.role = 'Choose a role'
    else if (!['admin', 'manager', 'user'].includes(role)) errors.role = 'Choose a valid role'
  }
  return errors
}

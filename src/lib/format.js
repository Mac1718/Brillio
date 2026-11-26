/** Every monetary value in the application is Indian Rupees. */
export const CURRENCY = 'INR'

export const DEFAULT_SETTINGS = {
  currency: CURRENCY,
  usefulLifeYears: 4,
  warrantyAlertDays: 30,
  dateOrder: 'auto',
  pageSize: 10,
}

// Indian digit grouping (lakhs and crores) with the ₹ symbol.
const inrFormat = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const inrDecimal = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 })

// Lakh / crore abbreviations for tight spaces (chart axes and summary cards).
// Intl's en-IN compact notation labels thousands with "T", which reads like
// trillions, so the grouping is written out explicitly.
function compactInr(value) {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1e7) return `${sign}₹${inrDecimal.format(abs / 1e7)}Cr`
  if (abs >= 1e5) return `${sign}₹${inrDecimal.format(abs / 1e5)}L`
  return inrFormat.format(value)
}

/**
 * Single currency formatter for the whole application.
 *
 * The second argument is kept so existing call sites that pass a currency keep
 * working, but it is deliberately ignored: amounts are never converted and are
 * always presented as INR. Numeric values themselves are never altered.
 */
export function formatCurrency(value, _currency, compact = false) {
  const numeric = typeof value === 'string' ? Number(value) : value
  if (numeric == null || Number.isNaN(numeric)) return '—'
  return compact ? compactInr(numeric) : inrFormat.format(numeric)
}

export function formatNumber(value) {
  if (value == null || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('en-IN').format(value)
}

export function formatDate(date) {
  if (!date) return '—'
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatMonthLabel(key) {
  if (!key) return ''
  const [year, month] = key.split('-')
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

export function titleCase(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
}

export function sum(list, selector) {
  return list.reduce((total, item) => {
    const value = selector(item)
    return total + (Number.isFinite(value) ? value : 0)
  }, 0)
}

export const STATUS_TONE = {
  Available: 'green',
  Assigned: 'blue',
  Maintenance: 'amber',
  Damaged: 'red',
  Retired: 'neutral',
  Other: 'neutral',
}

export const TONE_CLASS = {
  green: 'badge-green',
  amber: 'badge-amber',
  red: 'badge-red',
  blue: 'badge-blue',
  violet: 'badge-violet',
  neutral: 'badge-neutral',
}

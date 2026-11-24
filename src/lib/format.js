export const DEFAULT_SETTINGS = {
  currency: 'USD',
  usefulLifeYears: 4,
  warrantyAlertDays: 30,
  dateOrder: 'auto',
  pageSize: 10,
}

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AED', 'AUD', 'CAD', 'SGD', 'JPY', 'SAR']

const currencySymbols = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  AED: 'AED ',
  AUD: 'A$',
  CAD: 'C$',
  SGD: 'S$',
  JPY: '¥',
  SAR: 'SAR ',
}

export function formatCurrency(value, currency = 'USD', compact = false) {
  if (value == null || Number.isNaN(value)) return '—'
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: compact ? 1 : 0,
      notation: compact ? 'compact' : 'standard',
    }).format(value)
  } catch {
    return `${currencySymbols[currency] || ''}${Math.round(value)}`
  }
}

export function formatNumber(value) {
  if (value == null || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('en-US').format(value)
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

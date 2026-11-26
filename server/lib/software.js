import crypto from 'node:crypto'
import { parseAssessmentDate, isoDate, cleanText, parseNumber } from './validate.js'

export const LICENCE_TYPES = ['Perpetual', 'Subscription', 'Annual', 'Monthly', 'Trial', 'OEM', 'Open Source', 'Other']
export const SOFTWARE_STATUSES = ['Active', 'Inactive', 'Suspended', 'Retired']

/** Today as a UTC date-only number, so day boundaries never depend on the clock time. */
export function todayUtc(now = new Date()) {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
}

export function daysBetween(isoFrom, isoTo) {
  const from = Date.parse(`${isoFrom}T00:00:00Z`)
  const to = Date.parse(`${isoTo}T00:00:00Z`)
  if (Number.isNaN(from) || Number.isNaN(to)) return null
  return Math.round((to - from) / 86400000)
}

/**
 * Expiry state from the actual expiry date.
 *   expired      : expiry date is before today
 *   expiring30   : expires today or within the next 30 days
 *   expiring60   : expires within the next 60 days
 *   active       : more than 60 days remaining
 */
export function expiryState(daysRemaining) {
  if (daysRemaining == null) return 'unknown'
  if (daysRemaining < 0) return 'expired'
  if (daysRemaining <= 30) return 'expiring30'
  if (daysRemaining <= 60) return 'expiring60'
  return 'active'
}

export function withExpiry(record, now = new Date()) {
  const todayIso = isoDate(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate())
  const daysRemaining = record.expiryDate ? daysBetween(todayIso, record.expiryDate) : null
  const state = expiryState(daysRemaining)
  return { ...record, daysRemaining, expiryState: state, statusConflict: statusConflict(record.softwareStatus, state) }
}

/**
 * The imported status is shown exactly as stored. When it disagrees with the
 * expiry date this returns an explanation instead of rewriting either value.
 */
export function statusConflict(softwareStatus, state) {
  const status = String(softwareStatus || '').toLowerCase()
  if (!status) return null
  const impliesActive = /(active|in ?use|current|valid|live|enabled)/.test(status)
  const impliesInactive = /(expir|retir|inactive|suspend|terminat|cancel|decommission)/.test(status)
  if (impliesActive && state === 'expired') return `Status is “${softwareStatus}” but the expire date has passed`
  if (impliesInactive && ['active', 'expiring60', 'expiring30'].includes(state)) {
    return `Status is “${softwareStatus}” but the expire date is still in the future`
  }
  return null
}

const text = (value, max = 300) => {
  if (value == null) return null
  const trimmed = String(value).replace(/\s+/g, ' ').trim()
  if (!trimmed) return null
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed
}

export function dedupeKeyForSoftware({ name, purchasedDate, expiryDate }) {
  return crypto
    .createHash('sha256')
    .update([name || '', purchasedDate || '', expiryDate || ''].join('|').toLowerCase())
    .digest('hex')
}

/** Validation shared by create and update so both paths behave identically. */
export function normalizeSoftware(input, { partial = false } = {}) {
  const errors = {}

  const name = text(input.name, 200)
  if (!partial || input.name !== undefined) {
    if (!name) errors.name = 'Software name is required'
  }

  const parseRequiredDate = (value, key, label) => {
    if (value == null || String(value).trim() === '') {
      if (!partial || input[key] !== undefined) errors[key] = `${label} is required`
      return null
    }
    const parts = parseAssessmentDate(value)
    if (!parts) {
      errors[key] = `${label} is not a valid date`
      return null
    }
    return isoDate(parts.year, parts.month, parts.day)
  }

  const purchasedDate = parseRequiredDate(input.purchasedDate, 'purchasedDate', 'Purchased date')
  const expiryDate = parseRequiredDate(input.expiryDate, 'expiryDate', 'Expiry date')

  if (purchasedDate && expiryDate && expiryDate < purchasedDate) {
    errors.expiryDate = 'Expiry date cannot be before the purchased date'
  }

  let licenceQuantity = null
  const rawQuantity = input.licenceQuantity
  if (rawQuantity != null && String(rawQuantity).trim() !== '') {
    const parsed = parseNumber(rawQuantity)
    if (parsed == null || parsed < 0 || !Number.isFinite(parsed)) {
      errors.licenceQuantity = 'Licence quantity must be a positive number'
    } else {
      licenceQuantity = Math.round(parsed)
    }
  }

  // Known values are canonicalised; anything else is kept as typed rather than rejected.
  const statusRaw = text(input.softwareStatus, 40)
  const licenceRaw = text(input.licenceType, 60)
  const status = statusRaw ? SOFTWARE_STATUSES.find((entry) => entry.toLowerCase() === statusRaw.toLowerCase()) || statusRaw : 'Active'
  const licenceType = licenceRaw ? LICENCE_TYPES.find((entry) => entry.toLowerCase() === licenceRaw.toLowerCase()) || licenceRaw : null

  const record = {
    name,
    purchasedDate,
    expiryDate,
    vendorName: text(input.vendorName, 160),
    licenceType,
    licenceQuantity,
    softwareStatus: status,
    remarks: text(input.remarks, 2000),
  }

  record.dedupeKey = name && purchasedDate && expiryDate ? dedupeKeyForSoftware(record) : null

  return { record, errors, valid: Object.keys(errors).length === 0 }
}

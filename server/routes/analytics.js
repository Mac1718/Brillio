import express from 'express'
import { query } from '../db.js'
import { authenticate } from '../auth.js'
import { QUARTERS, classificationFromPoDate } from '../lib/validate.js'

const router = express.Router()
router.use(authenticate)

const emptyQuarter = (quarter) => ({
  quarter,
  total: 0,
  completed: 0,
  pending: 0,
  inProgress: 0,
  cancelled: 0,
  completionRate: null,
})

const bucketFor = (status) => {
  if (status === 'Completed') return 'completed'
  if (status === 'In Progress') return 'inProgress'
  if (status === 'Cancelled') return 'cancelled'
  return 'pending'
}

const rate = (completed, total) => (total ? Math.round((completed / total) * 1000) / 10 : null)

const num = (value) => (value == null || value === '' || Number.isNaN(Number(value)) ? 0 : Number(value))
const round = (value) => Math.round(value * 100) / 100

function financialGroups(rows, keyFn) {
  const map = new Map()
  rows.forEach((row) => {
    const key = String(keyFn(row) || '').trim() || 'Unspecified'
    if (!map.has(key)) map.set(key, { name: key, budget: 0, spend: 0, savings: 0, excess: 0, cost: 0 })
    const entry = map.get(key)
    entry.budget += num(row.budget)
    entry.spend += num(row.spend)
    entry.savings += num(row.savings)
    entry.excess += num(row.excess)
    entry.cost += num(row.q1) + num(row.q2) + num(row.q3) + num(row.q4)
  })
  return [...map.values()]
    .map((entry) => ({
      name: entry.name,
      budget: round(entry.budget),
      spend: round(entry.spend),
      savings: round(entry.savings),
      excess: round(entry.excess),
      cost: round(entry.cost),
    }))
    .sort((a, b) => b.budget - a.budget || b.cost - a.cost)
}

function groupCount(rows, keyFn) {
  const map = new Map()
  rows.forEach((row) => {
    const key = keyFn(row)
    if (key == null || key === '') return
    map.set(key, (map.get(key) || 0) + 1)
  })
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
}

router.get('/', async (req, res, next) => {
  try {
    const year = req.query.year ? Number(req.query.year) : null
    const quarter = req.query.quarter ? String(req.query.quarter).toUpperCase() : null
    const status = req.query.status ? String(req.query.status) : null
    const vendorId = req.query.vendorId ? String(req.query.vendorId) : null
    const city = req.query.city ? String(req.query.city) : null
    const department = req.query.department ? String(req.query.department).toLowerCase() : null
    const projectId = req.query.projectId ? String(req.query.projectId) : null
    const category = req.query.category ? String(req.query.category) : null
    const costType = req.query.costType ? String(req.query.costType) : null

    const rawRows = await query(
      `SELECT a.po_date AS po_date, a.assessment_status AS status,
              a.vendor_id AS vendor_id, a.vendor_name AS vendor_name,
              v.city AS city, v.state AS state, a.price AS price, a.quantity AS quantity,
              a.department AS department, a.source AS source,
              a.cost_q1 AS q1, a.cost_q2 AS q2, a.cost_q3 AS q3, a.cost_q4 AS q4,
              a.total_budget_fy AS budget, a.spend_fy AS spend, a.savings AS savings, a.excess AS excess,
              a.project_id AS project_id, a.project_name AS project_name, a.category AS category,
              a.cost_type AS cost_type
       FROM assessments a LEFT JOIN vendors v ON v.id = a.vendor_id`,
    )

    // PO Date is the single source of truth: year and quarter are derived from
    // it here, never from the upload or creation date.
    // A record without a readable PO Date stays unclassified and is reported
    // separately instead of being given a guessed quarter.
    const rows = rawRows.map((row) => {
      const classification = classificationFromPoDate(row.po_date)
      return { ...row, year: classification?.year ?? null, quarter: classification?.quarter ?? null }
    })
    const unclassifiedCount = rows.filter((row) => row.year == null).length

    const matches = (row, { skipYear = false } = {}) => {
      if (!skipYear && year != null && Number(row.year) !== year) return false
      if (skipYear && year == null) return true
      if (quarter && row.quarter !== quarter) return false
      if (status && row.status !== status) return false
      if (vendorId && row.vendor_id !== vendorId) return false
      if (city && row.city !== city) return false
      if (department && String(row.department || '').toLowerCase() !== department) return false
      if (projectId && String(row.project_id || '') !== projectId) return false
      if (category && String(row.category || '') !== category) return false
      if (costType && String(row.cost_type || '') !== costType) return false
      return true
    }

    const filtered = rows.filter((row) => matches(row))
    const totals = {
      total: filtered.length,
      completed: 0,
      pending: 0,
      inProgress: 0,
      cancelled: 0,
      assets: 0,
      value: 0,
      completionRate: null,
      vendors: new Set(),
      cities: new Set(),
      distinctYears: new Set(),
    }

    filtered.forEach((row) => {
      const bucket = bucketFor(row.status)
      totals[bucket] += 1
      totals.assets += Number(row.quantity) > 0 ? Number(row.quantity) : 1
      if (Number.isFinite(Number(row.price))) totals.value += Number(row.price) * (Number(row.quantity) > 0 ? Number(row.quantity) : 1)
      if (row.vendor_id) totals.vendors.add(row.vendor_id)
      if (row.city) totals.cities.add(row.city)
      if (row.year != null) totals.distinctYears.add(Number(row.year))
    })
    totals.completionRate = rate(totals.completed, totals.total)

    const quarters = QUARTERS.map((label) => {
      const bucket = emptyQuarter(label)
      filtered
        .filter((row) => row.quarter === label)
        .forEach((row) => {
          bucket.total += 1
          bucket[bucketFor(row.status)] += 1
        })
      bucket.completionRate = rate(bucket.completed, bucket.total)
      return bucket
    })

    const byYearMap = new Map()
    rows
      .filter((row) => row.year != null && matches(row, { skipYear: true }))
      .forEach((row) => {
        const key = Number(row.year)
        if (!byYearMap.has(key)) byYearMap.set(key, { year: key, total: 0, completed: 0, pending: 0, inProgress: 0, cancelled: 0 })
        const bucket = byYearMap.get(key)
        bucket.total += 1
        bucket[bucketFor(row.status)] += 1
      })
    const byYear = [...byYearMap.values()]
      .sort((a, b) => a.year - b.year)
      .map((row) => ({ ...row, completionRate: rate(row.completed, row.total) }))

    const activeYear = year != null ? year : byYear.length ? byYear[byYear.length - 1].year : null
    const months = Array.from({ length: 12 }, (_, index) => ({ name: index + 1, total: 0, completed: 0 }))
    if (activeYear != null) {
      filtered
        .filter((row) => Number(row.year) === activeYear && row.po_date)
        .forEach((row) => {
          const month = Number(String(row.po_date).slice(5, 7))
          if (month >= 1 && month <= 12) {
            months[month - 1].total += 1
            if (row.status === 'Completed') months[month - 1].completed += 1
          }
        })
    }

    const hasFinancialData = filtered.some((row) =>
      [row.q1, row.q2, row.q3, row.q4, row.budget, row.spend, row.savings, row.excess].some((value) => value != null && value !== ''),
    )
    const financial = {
      hasFinancialData,
      totals: {
        costQ1: round(filtered.reduce((total, row) => total + num(row.q1), 0)),
        costQ2: round(filtered.reduce((total, row) => total + num(row.q2), 0)),
        costQ3: round(filtered.reduce((total, row) => total + num(row.q3), 0)),
        costQ4: round(filtered.reduce((total, row) => total + num(row.q4), 0)),
        budget: round(filtered.reduce((total, row) => total + num(row.budget), 0)),
        spend: round(filtered.reduce((total, row) => total + num(row.spend), 0)),
        savings: round(filtered.reduce((total, row) => total + num(row.savings), 0)),
        excess: round(filtered.reduce((total, row) => total + num(row.excess), 0)),
      },
      quarters: QUARTERS.map((label, index) => ({
        name: label,
        cost: round(filtered.reduce((total, row) => total + num(row[`q${index + 1}`]), 0)),
      })),
      byDepartment: financialGroups(filtered, (row) => row.department).slice(0, 12),
      byVendor: financialGroups(filtered, (row) => row.vendor_name || 'Unassigned vendor').slice(0, 12),
      byProject: financialGroups(filtered, (row) => row.project_name || row.project_id || 'No project').slice(0, 12),
      byCategory: financialGroups(filtered, (row) => row.category || 'Uncategorised').slice(0, 12),
    }
    financial.totals.costTotal = round(
      financial.totals.costQ1 + financial.totals.costQ2 + financial.totals.costQ3 + financial.totals.costQ4,
    )

    const yearRows = rows.filter((row) => matches(row) && row.year != null).map((row) => Number(row.year))
    const firstYear = yearRows.length ? Math.min(...yearRows) : null
    const lastYear = yearRows.length ? Math.max(...yearRows) : null

    res.json({
      filters: { year, quarter, status, vendorId, city, department, projectId, category, costType },
      // Records without a readable PO Date cannot be placed in a year/quarter.
      // They are counted here and surfaced in the UI instead of being assigned
      // to an invented period.
      unclassifiedCount,
      availableYears: [...new Set(rows.map((row) => row.year).filter((value) => value != null))].sort((a, b) => b - a),
      totals: {
        ...totals,
        vendors: totals.vendors.size,
        cities: totals.cities.size,
        yearCount: totals.distinctYears.size,
        span: firstYear && lastYear ? { from: firstYear, to: lastYear } : null,
        value: Math.round(totals.value),
      },
      quarters,
      byStatus: groupCount(filtered, (row) => row.status),
      byQuarterStatus: QUARTERS.map((label) => ({
        name: label,
        Completed: filtered.filter((row) => row.quarter === label && row.status === 'Completed').length,
        Pending: filtered.filter((row) => row.quarter === label && row.status === 'Pending').length,
        'In Progress': filtered.filter((row) => row.quarter === label && row.status === 'In Progress').length,
        Cancelled: filtered.filter((row) => row.quarter === label && row.status === 'Cancelled').length,
      })),
      byVendor: groupCount(filtered, (row) => row.vendor_name || 'Unassigned vendor').slice(0, 12),
      byCity: groupCount(filtered, (row) => row.city || 'No city').slice(0, 12),
      byDepartment: groupCount(filtered, (row) => row.department || 'Unspecified').slice(0, 12),
      byYear,
      financial,
      monthly: months.map((month) => ({
        name: new Date(Date.UTC(activeYear || 2000, month.name - 1, 1)).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }),
        total: month.total,
        completed: month.completed,
      })),
      activeYear,
      totalRecords: rows.length,
    })
  } catch (error) {
    next(error)
  }
})

export default router

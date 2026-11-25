import express from 'express'
import { query } from '../db.js'
import { authenticate } from '../auth.js'
import { QUARTERS } from '../lib/validate.js'

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

    const rows = await query(
      `SELECT a.assessment_year AS year, a.assessment_quarter AS quarter, a.assessment_status AS status,
              a.assessment_date AS date, a.vendor_id AS vendor_id, a.vendor_name AS vendor_name,
              v.city AS city, v.state AS state, a.price AS price, a.quantity AS quantity,
              a.department AS department, a.source AS source
       FROM assessments a LEFT JOIN vendors v ON v.id = a.vendor_id`,
    )

    const matches = (row, { skipYear = false } = {}) => {
      if (!skipYear && year != null && Number(row.year) !== year) return false
      if (skipYear && year == null) return true
      if (quarter && row.quarter !== quarter) return false
      if (status && row.status !== status) return false
      if (vendorId && row.vendor_id !== vendorId) return false
      if (city && row.city !== city) return false
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
      totals.distinctYears.add(Number(row.year))
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
      .filter((row) => matches(row, { skipYear: true }))
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
        .filter((row) => Number(row.year) === activeYear && row.date)
        .forEach((row) => {
          const month = Number(String(row.date).slice(5, 7))
          if (month >= 1 && month <= 12) {
            months[month - 1].total += 1
            if (row.status === 'Completed') months[month - 1].completed += 1
          }
        })
    }

    const yearRows = rows.filter((row) => matches(row)).map((row) => Number(row.year)).filter(Number.isFinite)
    const firstYear = yearRows.length ? Math.min(...yearRows) : null
    const lastYear = yearRows.length ? Math.max(...yearRows) : null

    res.json({
      filters: { year, quarter, status, vendorId, city },
      availableYears: [...new Set(rows.map((row) => Number(row.year)).filter(Number.isFinite))].sort((a, b) => b - a),
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

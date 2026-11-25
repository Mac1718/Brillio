import express from 'express'
import crypto from 'node:crypto'
import { one, query } from '../db.js'
import { authenticate, requireAdmin } from '../auth.js'
import { HttpError } from '../lib/http.js'

const router = express.Router()
router.use(authenticate)

const shape = (row) => ({
  id: row.id,
  name: row.name,
  city: row.city,
  state: row.state,
  address: row.address,
  contactPerson: row.contact_person,
  email: row.email,
  phone: row.phone,
  category: row.category,
  notes: row.notes,
  assessmentCount: row.assessment_count != null ? Number(row.assessment_count) : undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const text = (value, max = 300) => {
  if (value == null) return null
  const trimmed = String(value).replace(/\s+/g, ' ').trim()
  if (!trimmed) return null
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed
}

function validateVendor(body, { partial = false } = {}) {
  const errors = {}
  if (!partial || body.name !== undefined) {
    if (!text(body.name)) errors.name = 'Vendor name is required'
  }
  if (!partial || body.city !== undefined) {
    if (!text(body.city)) errors.city = 'City is required'
  }
  if (!partial || body.state !== undefined) {
    if (!text(body.state)) errors.state = 'State is required'
  }
  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(body.email).trim())) {
    errors.email = 'Enter a valid email address'
  }
  return errors
}

router.get('/', async (req, res, next) => {
  try {
    const clauses = []
    const params = []
    const search = String(req.query.search || '').trim().toLowerCase()
    if (search) {
      clauses.push('(LOWER(name) LIKE ? OR LOWER(city) LIKE ? OR LOWER(state) LIKE ? OR LOWER(COALESCE(contact_person, \'\')) LIKE ? OR LOWER(COALESCE(category, \'\')) LIKE ?)')
      const like = `%${search}%`
      params.push(like, like, like, like, like)
    }
    if (req.query.city) {
      clauses.push('LOWER(city) = ?')
      params.push(String(req.query.city).toLowerCase())
    }
    if (req.query.category) {
      clauses.push('LOWER(COALESCE(category, \'\')) = ?')
      params.push(String(req.query.category).toLowerCase())
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

    const rows = await query(`SELECT * FROM vendors ${where} ORDER BY city ASC, name ASC`, params)
    const cities = await query(
      `SELECT v.city, v.state, COUNT(DISTINCT v.id) AS vendor_count, COUNT(a.id) AS assessment_count
       FROM vendors v LEFT JOIN assessments a ON a.vendor_id = v.id
       GROUP BY v.city, v.state ORDER BY vendor_count DESC`,
    )
    const categories = await query('SELECT DISTINCT category FROM vendors WHERE category IS NOT NULL ORDER BY category ASC')

    res.json({
      items: rows.map(shape),
      cities: cities.map((row) => ({
        city: row.city,
        state: row.state,
        vendorCount: Number(row.vendor_count),
        assessmentCount: Number(row.assessment_count),
      })),
      categories: categories.map((row) => row.category),
    })
  } catch (error) {
    next(error)
  }
})

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const errors = validateVendor(req.body || {})
    if (Object.keys(errors).length) return res.status(422).json({ error: 'Please correct the highlighted fields', fields: errors })

    const name = text(req.body.name, 160)
    const city = text(req.body.city, 100)
    const duplicate = await one('SELECT id FROM vendors WHERE LOWER(name) = ? AND LOWER(city) = ?', [name.toLowerCase(), city.toLowerCase()])
    if (duplicate) return res.status(409).json({ error: 'A vendor with this name already exists in that city' })

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    await query(
      `INSERT INTO vendors (id, name, city, state, address, contact_person, email, phone, category, notes, created_at, updated_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        city,
        text(req.body.state, 100),
        text(req.body.address, 500),
        text(req.body.contactPerson, 160),
        text(req.body.email, 200),
        text(req.body.phone, 60),
        text(req.body.category, 80),
        text(req.body.notes, 1000),
        now,
        now,
        req.user.id,
      ],
    )
    const created = await one('SELECT * FROM vendors WHERE id = ?', [id])
    res.status(201).json({ item: shape(created) })
  } catch (error) {
    next(error)
  }
})

router.patch('/:id', requireAdmin, async (req, res, next) => {
  try {
    const existing = await one('SELECT * FROM vendors WHERE id = ?', [req.params.id])
    if (!existing) throw new HttpError(404, 'Vendor not found')

    const errors = validateVendor(req.body || {}, { partial: true })
    if (Object.keys(errors).length) return res.status(422).json({ error: 'Please correct the highlighted fields', fields: errors })

    const nextName = req.body.name !== undefined ? text(req.body.name, 160) : existing.name
    const nextCity = req.body.city !== undefined ? text(req.body.city, 100) : existing.city
    if (!nextName || !nextCity) return res.status(422).json({ error: 'Vendor name and city are required' })

    const clash = await one('SELECT id FROM vendors WHERE LOWER(name) = ? AND LOWER(city) = ? AND id <> ?', [
      nextName.toLowerCase(),
      nextCity.toLowerCase(),
      existing.id,
    ])
    if (clash) return res.status(409).json({ error: 'A vendor with this name already exists in that city' })

    await query(
      `UPDATE vendors SET name = ?, city = ?, state = ?, address = ?, contact_person = ?, email = ?, phone = ?,
         category = ?, notes = ?, updated_at = ? WHERE id = ?`,
      [
        nextName,
        nextCity,
        req.body.state !== undefined ? text(req.body.state, 100) : existing.state,
        req.body.address !== undefined ? text(req.body.address, 500) : existing.address,
        req.body.contactPerson !== undefined ? text(req.body.contactPerson, 160) : existing.contact_person,
        req.body.email !== undefined ? text(req.body.email, 200) : existing.email,
        req.body.phone !== undefined ? text(req.body.phone, 60) : existing.phone,
        req.body.category !== undefined ? text(req.body.category, 80) : existing.category,
        req.body.notes !== undefined ? text(req.body.notes, 1000) : existing.notes,
        new Date().toISOString(),
        existing.id,
      ],
    )

    const updated = await one('SELECT * FROM vendors WHERE id = ?', [existing.id])
    res.json({ item: shape(updated) })
  } catch (error) {
    next(error)
  }
})

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const existing = await one('SELECT id FROM vendors WHERE id = ?', [req.params.id])
    if (!existing) throw new HttpError(404, 'Vendor not found')

    const linked = await one('SELECT COUNT(*) AS total FROM assessments WHERE vendor_id = ?', [existing.id])
    // Historical records keep their vendor name, but the association is cleared
    // so no assessment is left pointing at a deleted vendor.
    await query('UPDATE assessments SET vendor_id = NULL WHERE vendor_id = ?', [existing.id])
    await query('DELETE FROM vendors WHERE id = ?', [existing.id])
    res.json({ ok: true, detachedAssessments: Number(linked.total) })
  } catch (error) {
    next(error)
  }
})

export default router

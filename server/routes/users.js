import express from 'express'
import crypto from 'node:crypto'
import { one, query } from '../db.js'
import { authenticate, hashPassword, ROLES, requireAdmin } from '../auth.js'
import { cleanText, validateUser } from '../lib/validate.js'

const router = express.Router()

// Every route here is administrator-only: managers and users get 403 even if
// they construct requests by hand.
router.use(authenticate, requireAdmin)

const shape = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  isActive: Boolean(Number(row.is_active)),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const deriveName = (email) =>
  email
    .split('@')[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || email

const activeAdmins = async () =>
  Number((await one("SELECT COUNT(*) AS total FROM users WHERE role = 'admin' AND is_active = 1"))?.total || 0)

const badRequest = (res, message, fields) =>
  res.status(422).json({ error: message, ...(fields ? { fields } : {}) })

router.get('/', async (req, res, next) => {
  try {
    const clauses = []
    const params = []
    const search = String(req.query.search || '').trim().toLowerCase()
    if (search) {
      clauses.push('(LOWER(email) LIKE ? OR LOWER(name) LIKE ?)')
      params.push(`%${search}%`, `%${search}%`)
    }
    if (req.query.role) {
      clauses.push('role = ?')
      params.push(String(req.query.role))
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const rows = await query(`SELECT * FROM users ${where} ORDER BY created_at ASC`, params)
    res.json({ items: rows.map(shape), roles: ROLES })
  } catch (error) {
    next(error)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const body = req.body || {}
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const confirmPassword = body.confirmPassword === undefined ? password : String(body.confirmPassword)

    const errors = validateUser({ email, password, role: body.role })
    if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match'
    if (Object.keys(errors).length) {
      return res.status(422).json({ error: Object.values(errors)[0], fields: errors })
    }

    if (await one('SELECT id FROM users WHERE email = ?', [email])) {
      return res.status(409).json({ error: 'An account with this email already exists', fields: { email: 'Already registered' } })
    }

    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    await query(
      `INSERT INTO users (id, name, email, password_hash, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, cleanText(body.name, 120) || deriveName(email), email, await hashPassword(password), body.role, now, now],
    )
    const created = await one('SELECT * FROM users WHERE id = ?', [id])
    res.status(201).json({ user: shape(created) })
  } catch (error) {
    next(error)
  }
})

router.patch('/:id', async (req, res, next) => {
  try {
    const target = await one('SELECT * FROM users WHERE id = ?', [req.params.id])
    if (!target) return res.status(404).json({ error: 'User not found' })

    const body = req.body || {}
    const isSelf = target.id === req.user.id
    const targetIsActiveAdmin = target.role === 'admin' && Number(target.is_active) === 1

    if (isSelf && body.role !== undefined && body.role !== target.role) {
      return res.status(403).json({ error: 'You cannot change your own role' })
    }
    if (isSelf && body.isActive === false) {
      return res.status(403).json({ error: 'You cannot disable your own account' })
    }

    const errors = validateUser(
      { name: body.name, email: body.email, password: body.password, role: body.role },
      { partial: true },
    )
    if (body.password !== undefined && body.confirmPassword !== undefined && String(body.password) !== String(body.confirmPassword)) {
      errors.confirmPassword = 'Passwords do not match'
    }
    if (Object.keys(errors).length) return badRequest(res, Object.values(errors)[0], errors)

    // Never let the last active administrator lose admin access.
    if (targetIsActiveAdmin && body.role !== undefined && body.role !== 'admin' && (await activeAdmins()) <= 1) {
      return res.status(409).json({ error: 'At least one active administrator is required' })
    }
    if (targetIsActiveAdmin && body.isActive === false && (await activeAdmins()) <= 1) {
      return res.status(409).json({ error: 'At least one active administrator is required' })
    }

    const updates = []
    const params = []
    if (body.name !== undefined) {
      updates.push('name = ?')
      params.push(cleanText(body.name, 120) || deriveName(target.email))
    }
    if (body.email !== undefined) {
      const email = String(body.email).trim().toLowerCase()
      const clash = await one('SELECT id FROM users WHERE email = ? AND id <> ?', [email, target.id])
      if (clash) return res.status(409).json({ error: 'Another account already uses this email', fields: { email: 'Already registered' } })
      updates.push('email = ?')
      params.push(email)
    }
    if (body.role !== undefined) {
      updates.push('role = ?')
      params.push(body.role)
    }
    if (body.isActive !== undefined) {
      updates.push('is_active = ?')
      params.push(body.isActive ? 1 : 0)
    }
    if (body.password) {
      updates.push('password_hash = ?')
      params.push(await hashPassword(String(body.password)))
    }
    if (!updates.length) return badRequest(res, 'Nothing to update')

    updates.push('updated_at = ?')
    params.push(new Date().toISOString())
    params.push(target.id)
    await query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params)

    const updated = await one('SELECT * FROM users WHERE id = ?', [target.id])
    res.json({ user: shape(updated) })
  } catch (error) {
    next(error)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const target = await one('SELECT * FROM users WHERE id = ?', [req.params.id])
    if (!target) return res.status(404).json({ error: 'User not found' })
    if (target.id === req.user.id) return res.status(403).json({ error: 'You cannot delete your own account' })
    if (target.role === 'admin' && Number(target.is_active) === 1 && (await activeAdmins()) <= 1) {
      return res.status(409).json({ error: 'At least one active administrator is required' })
    }
    await query('DELETE FROM users WHERE id = ?', [target.id])
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

export default router

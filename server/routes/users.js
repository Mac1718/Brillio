import express from 'express'
import crypto from 'node:crypto'
import { one, query } from '../db.js'
import { authenticate, hashPassword, requireAdmin } from '../auth.js'
import { validateUser } from '../lib/validate.js'

const router = express.Router()

router.use(authenticate)

const shape = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  isActive: Boolean(Number(row.is_active)),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const rows = await query('SELECT * FROM users ORDER BY created_at ASC')
    res.json({ items: rows.map(shape) })
  } catch (error) {
    next(error)
  }
})

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const body = req.body || {}
    const role = body.role || 'user'
    const errors = validateUser({ name: body.name, email: body.email, password: body.password, role })
    if (Object.keys(errors).length) return res.status(422).json({ error: 'Please correct the highlighted fields', fields: errors })

    const email = String(body.email).trim().toLowerCase()
    if (await one('SELECT id FROM users WHERE email = ?', [email])) {
      return res.status(409).json({ error: 'An account with this email already exists', fields: { email: 'Already registered' } })
    }

    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    await query(
      `INSERT INTO users (id, name, email, password_hash, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, String(body.name).trim(), email, await hashPassword(String(body.password)), role, now, now],
    )
    const created = await one('SELECT * FROM users WHERE id = ?', [id])
    res.status(201).json({ user: shape(created) })
  } catch (error) {
    next(error)
  }
})

router.patch('/:id', requireAdmin, async (req, res, next) => {
  try {
    const target = await one('SELECT * FROM users WHERE id = ?', [req.params.id])
    if (!target) return res.status(404).json({ error: 'User not found' })

    const body = req.body || {}
    const isSelf = target.id === req.user.id
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
    if (Object.keys(errors).length) return res.status(422).json({ error: 'Please correct the highlighted fields', fields: errors })

    if (target.role === 'admin' && body.role && body.role !== 'admin') {
      const admins = await one("SELECT COUNT(*) AS total FROM users WHERE role = 'admin' AND is_active = 1")
      if (Number(admins.total) <= 1) return res.status(409).json({ error: 'At least one active administrator is required' })
    }

    const updates = []
    const params = []
    if (body.name !== undefined) {
      updates.push('name = ?')
      params.push(String(body.name).trim())
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
    if (!updates.length) return res.status(422).json({ error: 'Nothing to update' })

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

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const target = await one('SELECT * FROM users WHERE id = ?', [req.params.id])
    if (!target) return res.status(404).json({ error: 'User not found' })
    if (target.id === req.user.id) return res.status(403).json({ error: 'You cannot delete your own account' })
    if (target.role === 'admin') {
      const admins = await one("SELECT COUNT(*) AS total FROM users WHERE role = 'admin' AND is_active = 1")
      if (Number(admins.total) <= 1) return res.status(409).json({ error: 'At least one active administrator is required' })
    }
    await query('DELETE FROM users WHERE id = ?', [target.id])
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

export default router

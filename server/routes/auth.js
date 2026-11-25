import express from 'express'
import crypto from 'node:crypto'
import { config } from '../config.js'
import { one, query } from '../db.js'
import {
  clearSessionCookie,
  hashPassword,
  rateLimit,
  setSessionCookie,
  signToken,
  verifyPassword,
  authenticate,
} from '../auth.js'
import { validateUser } from '../lib/validate.js'

const router = express.Router()

const publicUser = (row) => ({ id: row.id, name: row.name, email: row.email, role: row.role })

router.post('/signup', rateLimit(), async (req, res, next) => {
  try {
    const body = req.body || {}
    const errors = validateUser({ name: body.name, email: body.email, password: body.password })
    if (Object.keys(errors).length) return res.status(422).json({ error: 'Please correct the highlighted fields', fields: errors })

    const email = String(body.email).trim().toLowerCase()
    const existing = await one('SELECT id FROM users WHERE email = ?', [email])
    if (existing) return res.status(409).json({ error: 'An account with this email already exists', fields: { email: 'Already registered' } })

    const count = await one('SELECT COUNT(*) AS total FROM users')
    const isFirstUser = Number(count?.total || 0) === 0
    const isBootstrap = config.bootstrapAdminEmail && config.bootstrapAdminEmail === email
    const role = isFirstUser || isBootstrap ? 'admin' : 'user'

    const now = new Date().toISOString()
    const user = {
      id: crypto.randomUUID(),
      name: String(body.name).trim(),
      email,
      password_hash: await hashPassword(String(body.password)),
      role,
      is_active: 1,
      created_at: now,
      updated_at: now,
    }
    await query(
      `INSERT INTO users (id, name, email, password_hash, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [user.id, user.name, user.email, user.password_hash, user.role, user.is_active, user.created_at, user.updated_at],
    )

    setSessionCookie(res, signToken(user))
    res.status(201).json({
      user: publicUser(user),
      bootstrappedAdmin: role === 'admin',
    })
  } catch (error) {
    next(error)
  }
})

router.post('/login', rateLimit(), async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase()
    const password = String(req.body?.password || '')
    if (!email || !password) return res.status(422).json({ error: 'Email and password are required' })

    const user = await one('SELECT * FROM users WHERE email = ?', [email])
    // Constant-ish work whether or not the account exists.
    const hash = user?.password_hash || '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid'
    const ok = await verifyPassword(password, hash)
    if (!user || !ok) return res.status(401).json({ error: 'Incorrect email or password' })
    if (!Number(user.is_active)) return res.status(403).json({ error: 'This account has been disabled' })

    setSessionCookie(res, signToken(user))
    res.json({ user: publicUser(user) })
  } catch (error) {
    next(error)
  }
})

router.post('/logout', (req, res) => {
  clearSessionCookie(res)
  res.json({ ok: true })
})

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user })
})

export default router

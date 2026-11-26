import express from 'express'
import { one, query } from '../db.js'
import { clearSessionCookie, hashPassword, rateLimit, setSessionCookie, signToken, verifyPassword, authenticate } from '../auth.js'
import { cleanText } from '../lib/validate.js'

const router = express.Router()

const publicUser = (row) => ({ id: row.id, name: row.name, email: row.email, role: row.role })

// Public registration is intentionally absent. Accounts are created only by an
// authenticated administrator through POST /api/users.

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

// Self-service profile update. Email and role stay administrator-managed, so a
// user can never grant themselves different access through this route.
router.patch('/profile', authenticate, async (req, res, next) => {
  try {
    const name = cleanText(req.body?.name, 120)
    if (!name) return res.status(422).json({ error: 'Enter your name', fields: { name: 'Enter your name' } })

    await query('UPDATE users SET name = ?, updated_at = ? WHERE id = ?', [name, new Date().toISOString(), req.user.id])
    const row = await one('SELECT * FROM users WHERE id = ?', [req.user.id])
    if (!row) return res.status(404).json({ error: 'Account not found' })
    res.json({ user: publicUser(row) })
  } catch (error) {
    next(error)
  }
})

// Password changes always require the current password and the same policy as
// administrator-created accounts.
router.post('/change-password', authenticate, rateLimit({ max: 10 }), async (req, res, next) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '')
    const newPassword = String(req.body?.newPassword || '')
    const confirmPassword = req.body?.confirmPassword === undefined ? newPassword : String(req.body.confirmPassword)

    const errors = {}
    if (!currentPassword) errors.currentPassword = 'Enter your current password'
    if (!newPassword) errors.newPassword = 'Enter a new password'
    else if (newPassword.length < 8) errors.newPassword = 'Use at least 8 characters'
    else if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      errors.newPassword = 'Include at least one letter and one number'
    }
    if (confirmPassword !== newPassword) errors.confirmPassword = 'Passwords do not match'
    if (newPassword && newPassword === currentPassword) errors.newPassword = 'Choose a password different from the current one'
    if (Object.keys(errors).length) return res.status(422).json({ error: Object.values(errors)[0], fields: errors })

    const user = await one('SELECT * FROM users WHERE id = ?', [req.user.id])
    if (!user) return res.status(404).json({ error: 'Account not found' })
    if (!(await verifyPassword(currentPassword, user.password_hash))) {
      return res.status(422).json({ error: 'Current password is incorrect', fields: { currentPassword: 'Current password is incorrect' } })
    }

    await query('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [
      await hashPassword(newPassword),
      new Date().toISOString(),
      req.user.id,
    ])
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

export default router

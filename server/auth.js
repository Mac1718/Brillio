import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { config } from './config.js'
import { one } from './db.js'

export const ROLES = ['admin', 'manager', 'user']

export const hashPassword = (password) => bcrypt.hash(password, 12)
export const verifyPassword = (password, hash) => bcrypt.compare(password, hash)

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: config.jwtTtl })
}

export function setSessionCookie(res, token) {
  res.cookie(config.cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    maxAge: 12 * 60 * 60 * 1000,
    path: '/',
  })
}

export function clearSessionCookie(res) {
  res.clearCookie(config.cookieName, { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, path: '/' })
}

function bearerToken(req) {
  const header = req.headers.authorization || ''
  return header.startsWith('Bearer ') ? header.slice(7) : null
}

/**
 * Verifies the session and reloads the user from the database on every request,
 * so a role change, deactivation or deletion takes effect immediately.
 */
export async function authenticate(req, res, next) {
  const token = req.cookies?.[config.cookieName] || bearerToken(req)
  if (!token) return res.status(401).json({ error: 'Authentication required' })
  try {
    const payload = jwt.verify(token, config.jwtSecret)
    const user = await one('SELECT id, name, email, role, is_active FROM users WHERE id = ?', [payload.sub])
    if (!user) return res.status(401).json({ error: 'Session is no longer valid' })
    if (!Number(user.is_active)) return res.status(403).json({ error: 'This account is disabled' })
    req.user = { id: user.id, name: user.name, email: user.email, role: user.role }
    next()
  } catch {
    return res.status(401).json({ error: 'Session expired, please sign in again' })
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' })
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'You do not have permission to perform this action' })
    next()
  }
}

export const requireAdmin = requireRole('admin')
export const requireWrite = requireRole('admin')

/** Simple in-memory throttling for credential endpoints. */
export function rateLimit({ windowMs = 15 * 60 * 1000, max = 20 } = {}) {
  const hits = new Map()
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`
    const now = Date.now()
    const entry = hits.get(key)
    if (!entry || now > entry.reset) {
      hits.set(key, { count: 1, reset: now + windowMs })
      return next()
    }
    entry.count += 1
    if (entry.count > max) {
      const retry = Math.ceil((entry.reset - now) / 1000)
      res.set('Retry-After', String(retry))
      return res.status(429).json({ error: 'Too many attempts. Please try again later.' })
    }
    next()
  }
}

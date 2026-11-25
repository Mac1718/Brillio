import express from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { config } from './config.js'
import { initDb, closeDb } from './db.js'
import { migrate } from './migrations.js'
import { hashPassword } from './auth.js'
import { HttpError } from './lib/http.js'
import { one, query } from './db.js'
import authRoutes from './routes/auth.js'
import userRoutes from './routes/users.js'
import assessmentRoutes from './routes/assessments.js'
import vendorRoutes from './routes/vendors.js'
import analyticsRoutes from './routes/analytics.js'
import datasetRoutes from './routes/dataset.js'

const app = express()

app.disable('x-powered-by')
app.set('trust proxy', 1)

// CSP is left to the deployment platform: the SPA loads a webfont stylesheet.
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }))
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())

if (config.corsOrigin) {
  const allowed = config.corsOrigin.split(',').map((origin) => origin.trim())
  app.use((req, res, next) => {
    const origin = req.headers.origin
    if (origin && allowed.includes(origin)) {
      res.set('Access-Control-Allow-Origin', origin)
      res.set('Access-Control-Allow-Credentials', 'true')
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204)
    next()
  })
}

app.use((req, res, next) => {
  const started = Date.now()
  const requestId = crypto.randomUUID()
  res.set('X-Request-Id', requestId)
  res.on('finish', () => {
    if (config.logLevel === 'silent') return
    const line = `${new Date().toISOString()} ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms ${requestId}`
    if (res.statusCode >= 500) console.error(line)
    else if (config.logLevel !== 'error') console.log(line)
  })
  next()
})

app.get('/api/health', async (req, res) => {
  try {
    await one('SELECT 1 AS ok')
    res.json({ status: 'ok', time: new Date().toISOString() })
  } catch {
    res.status(503).json({ status: 'degraded' })
  }
})

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/assessments', assessmentRoutes)
app.use('/api/vendors', vendorRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/dataset', datasetRoutes)

app.use('/api', (req, res) => {
  res.status(404).json({ error: `No API route for ${req.method} ${req.originalUrl}` })
})

const indexHtml = path.join(config.publicDir, 'index.html')
if (fs.existsSync(indexHtml)) {
  app.use(express.static(config.publicDir, { index: false, maxAge: config.isProd ? '1h' : 0 }))
  app.get('*', (req, res) => res.sendFile(indexHtml))
} else {
  app.get('/', (req, res) => {
    res.status(200).json({ service: 'brillo IT assessment API', ui: 'Run "npm run build" to serve the dashboard from this process.' })
  })
}

app.use((error, req, res, next) => {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message, ...(error.details ? { details: error.details } : {}) })
  }
  if (error?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `The file is larger than ${config.maxUploadMb} MB` })
  }
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large' })
  }
  console.error('[brillo] unhandled error', error)
  res.status(500).json({ error: 'Something went wrong on the server' })
})

async function ensureBootstrapAdmin() {
  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase()
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || ''
  if (!email || !password) return
  const existing = await one('SELECT id FROM users WHERE email = ?', [email])
  if (existing) return
  const now = new Date().toISOString()
  await query(
    `INSERT INTO users (id, name, email, password_hash, role, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'admin', 1, ?, ?)`,
    [crypto.randomUUID(), process.env.BOOTSTRAP_ADMIN_NAME || 'Administrator', email, await hashPassword(password), now, now],
  )
  console.log(`[brillo] created bootstrap administrator ${email}`)
}

async function start() {
  await initDb()
  await migrate()
  await ensureBootstrapAdmin()
  const server = app.listen(config.port, process.env.HOST || '0.0.0.0', () => {
    console.log(`[brillo] API listening on http://localhost:${config.port} (${config.isProd ? 'production' : 'development'})`)
  })

  const shutdown = async (signal) => {
    console.log(`[brillo] ${signal} received, shutting down`)
    server.close(async () => {
      await closeDb()
      process.exit(0)
    })
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

start().catch((error) => {
  console.error('[brillo] failed to start', error)
  process.exit(1)
})

export default app

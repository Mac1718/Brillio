import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(root, 'data')
const uploadDir = process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.join(dataDir, 'uploads')

for (const dir of [dataDir, uploadDir]) fs.mkdirSync(dir, { recursive: true })

const isProd = process.env.NODE_ENV === 'production'
const jwtSecret = process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me'

if (isProd && /dev-only-insecure/.test(jwtSecret)) {
  console.warn('[brillo] JWT_SECRET is not set. Refusing to start in production with the development secret.')
  process.exit(1)
}

const parsedPort = Number(process.env.PORT)

// Some shells export PORT=0; only honour a usable port number.
export const config = {
  isProd,
  port: Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 4000,
  databaseUrl: process.env.DATABASE_URL || `sqlite:${path.join(dataDir, 'brillo.db')}`,
  dbSsl: process.env.DATABASE_SSL === 'true',
  jwtSecret,
  jwtTtl: process.env.JWT_TTL || '12h',
  cookieName: 'brillo_session',
  cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProd,
  corsOrigin: process.env.CORS_ORIGIN || '',
  dataDir,
  uploadDir,
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 25),
  publicDir: path.join(root, 'dist'),
  logLevel: process.env.LOG_LEVEL || 'info',
}

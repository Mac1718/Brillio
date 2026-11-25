import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.js'

let dialect = null
let sqlite = null
let pool = null

function resolveDialect() {
  if (/^postgres(ql)?:\/\//.test(config.databaseUrl)) return 'postgres'
  if (/^sqlite:/.test(config.databaseUrl)) return 'sqlite'
  throw new Error('DATABASE_URL must be a postgres:// or sqlite: URL')
}

export function getDialect() {
  if (!dialect) dialect = resolveDialect()
  return dialect
}

/** Replace portable ? placeholders with Postgres $n placeholders. */
const toPg = (sql) => {
  let index = 0
  return sql.replace(/\?/g, () => `$${++index}`)
}

const clean = (value) => {
  if (value === undefined) return null
  if (typeof value === 'boolean') return value ? 1 : 0
  return value
}

export async function initDb() {
  if (getDialect() === 'postgres') {
    const pg = (await import('pg')).default
    pool = new pg.Pool({
      connectionString: config.databaseUrl,
      ssl: config.dbSsl ? { rejectUnauthorized: false } : undefined,
      max: Number(process.env.DB_POOL_MAX || 10),
    })
    await pool.query('SELECT 1')
    return
  }

  const { DatabaseSync } = await import('node:sqlite')
  const file = config.databaseUrl.replace(/^sqlite:/, '')
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true })
  sqlite = new DatabaseSync(file)
  sqlite.exec('PRAGMA journal_mode = WAL')
  sqlite.exec('PRAGMA foreign_keys = ON')
}

export async function query(text, params = []) {
  const values = params.map(clean)
  if (getDialect() === 'postgres') {
    const result = await pool.query(toPg(text), values)
    return result.rows
  }
  return sqlite.prepare(text).all(...values)
}

export async function one(text, params = []) {
  const rows = await query(text, params)
  return rows[0] || null
}

/** Execute one or more statements with no parameters (DDL, migrations). */
export async function exec(sql) {
  if (getDialect() === 'postgres') {
    await pool.query(sql)
    return
  }
  sqlite.exec(sql)
}

export async function tx(fn) {
  if (getDialect() === 'postgres') {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const scoped = {
        query: async (text, params = []) => (await client.query(toPg(text), params.map(clean))).rows,
      }
      const result = await fn(scoped)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  sqlite.exec('BEGIN IMMEDIATE')
  try {
    const result = await fn({
      query: async (text, params = []) => sqlite.prepare(text).all(...params.map(clean)),
    })
    sqlite.exec('COMMIT')
    return result
  } catch (error) {
    sqlite.exec('ROLLBACK')
    throw error
  }
}

export async function closeDb() {
  if (pool) await pool.end()
  if (sqlite) sqlite.close()
}

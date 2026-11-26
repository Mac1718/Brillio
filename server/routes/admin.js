import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import { tx } from '../db.js'
import { config } from '../config.js'
import { authenticate, requireAdmin } from '../auth.js'
import { HttpError } from '../lib/http.js'

const router = express.Router()
router.use(authenticate, requireAdmin)

/**
 * Removes every business record while keeping user accounts, roles, schema and
 * configuration intact. The caller must type CLEAR, so a stray request cannot
 * wipe genuine company data.
 */
router.post('/clear-data', async (req, res, next) => {
  try {
    if (String(req.body?.confirm || '').trim().toUpperCase() !== 'CLEAR') {
      throw new HttpError(400, 'Type CLEAR to confirm permanent deletion of business records')
    }

    const { counts, storedFiles } = await tx(async (scoped) => {
      const countOf = async (table) => {
        const rows = await scoped.query(`SELECT COUNT(*) AS total FROM ${table}`)
        return Number(rows[0]?.total || 0)
      }
      const removed = {
        assessments: await countOf('assessments'),
        vendors: await countOf('vendors'),
        software: await countOf('software_assets'),
        imports: await countOf('imports'),
      }
      const files = (await scoped.query('SELECT stored_path FROM imports'))
        .map((row) => row.stored_path)
        .filter(Boolean)
      await scoped.query('DELETE FROM import_sheets')
      await scoped.query('DELETE FROM imports')
      await scoped.query('DELETE FROM software_assets')
      await scoped.query('DELETE FROM assessments')
      await scoped.query('DELETE FROM vendors')
      return { counts: removed, storedFiles: files }
    })

    // Stored workbooks belong to the removed imports; drop them after commit.
    for (const name of storedFiles) {
      try {
        fs.unlinkSync(path.resolve(config.uploadDir, path.basename(name)))
      } catch {
        // A missing file must not fail the clear operation.
      }
    }

    res.json({ ok: true, removed: counts })
  } catch (error) {
    next(error)
  }
})

export default router

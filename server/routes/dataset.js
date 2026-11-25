import express from 'express'
import { one, query } from '../db.js'
import { authenticate } from '../auth.js'

const router = express.Router()
router.use(authenticate)

/**
 * The dashboard pages were built around the shape of an imported workbook.
 * This endpoint returns the latest import's supporting worksheets so those
 * pages keep working against database-backed data.
 */
router.get('/', async (req, res, next) => {
  try {
    const latest = await one('SELECT * FROM imports ORDER BY created_at DESC LIMIT 1')
    const sheets = latest ? await query('SELECT kind, payload FROM import_sheets WHERE import_id = ?', [latest.id]) : []
    const find = (kind) => {
      const row = sheets.find((sheet) => sheet.kind === kind)
      return row ? JSON.parse(row.payload) : null
    }
    res.json({
      meta: latest
        ? {
            importId: latest.id,
            fileName: latest.file_name,
            sheetName: latest.sheet_name,
            rowCount: latest.row_count,
            importedCount: latest.imported_count,
            importedAt: latest.created_at,
          }
        : null,
      tickets: find('tickets'),
      maintenance: find('maintenance'),
    })
  } catch (error) {
    next(error)
  }
})

export default router

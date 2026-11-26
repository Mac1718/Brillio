import express from 'express'
import crypto from 'node:crypto'
import multer from 'multer'
import { config } from '../config.js'
import { one, query, tx } from '../db.js'
import { authenticate, requireAdmin } from '../auth.js'
import { HttpError } from '../lib/http.js'
import { LICENCE_TYPES, SOFTWARE_STATUSES, dedupeKeyForSoftware, normalizeSoftware, withExpiry } from '../lib/software.js'
import {
  analyseSamSheet,
  buildSamTemplate,
  isAcceptedSamFile,
  parseSamWorkbook,
} from '../lib/samExcel.js'

const router = express.Router()
router.use(authenticate)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1 },
})

const shape = (row, now) => {
  let rawValues = null
  if (row.raw_row) {
    try {
      rawValues = JSON.parse(row.raw_row)
    } catch {
      rawValues = null
    }
  }
  return withExpiry(
    {
      id: row.id,
      name: row.name,
      purchasedDate: row.purchased_date,
      expiryDate: row.expiry_date,
      vendorId: row.vendor_id,
      vendorName: row.vendor_name,
      licenceType: row.licence_type,
      licenceQuantity: row.licence_quantity,
      softwareStatus: row.software_status,
      remarks: row.remarks,
      source: row.source || 'manual',
      rawValues,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    now,
  )
}

const SORTS = {
  'expiry-asc': 's.expiry_date ASC, LOWER(s.name) ASC',
  'expiry-desc': 's.expiry_date DESC, LOWER(s.name) ASC',
  'purchase-asc': 's.purchased_date ASC, LOWER(s.name) ASC',
  'purchase-desc': 's.purchased_date DESC, LOWER(s.name) ASC',
  'name-asc': 'LOWER(s.name) ASC',
}

const isoToday = (now = new Date()) =>
  `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`

const addDays = (iso, days) => {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return isoToday(date)
}

/** Live statistics over every stored record, independent of the table filters. */
export async function samStatistics() {
  const today = isoToday()
  const horizon = addDays(today, 30)
  const row = await one(
    `SELECT COUNT(*) AS total,
       COALESCE(SUM(CASE WHEN expiry_date < ? THEN 1 ELSE 0 END), 0) AS expired,
       COALESCE(SUM(CASE WHEN expiry_date >= ? AND expiry_date <= ? THEN 1 ELSE 0 END), 0) AS expiring30,
       COALESCE(SUM(CASE WHEN expiry_date > ? THEN 1 ELSE 0 END), 0) AS active
     FROM software_assets`,
    [today, today, horizon, horizon],
  )
  return {
    total: Number(row?.total || 0),
    active: Number(row?.active || 0),
    expired: Number(row?.expired || 0),
    expiring30: Number(row?.expiring30 || 0),
  }
}

router.get('/', async (req, res, next) => {
  try {
    const clauses = []
    const params = []

    const search = String(req.query.search || '').trim().toLowerCase()
    if (search) {
      clauses.push("(LOWER(s.name) LIKE ? OR LOWER(COALESCE(s.vendor_name, '')) LIKE ?)")
      const like = `%${search}%`
      params.push(like, like)
    }
    if (req.query.softwareStatus) {
      clauses.push("LOWER(COALESCE(s.software_status, '')) = ?")
      params.push(String(req.query.softwareStatus).trim().toLowerCase())
    }
    if (req.query.vendorId) {
      clauses.push('s.vendor_id = ?')
      params.push(String(req.query.vendorId))
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const order = SORTS[String(req.query.sort || '')] || SORTS['expiry-asc']

    const rows = await query(
      `SELECT s.*, v.city AS vendor_city, v.state AS vendor_state
       FROM software_assets s LEFT JOIN vendors v ON v.id = s.vendor_id
       ${where}
       ORDER BY ${order}`,
      params,
    )

    const now = new Date()
    const items = rows.map((row) => shape(row, now))
    const summary = await samStatistics()

    const statusRows = await query(
      "SELECT DISTINCT software_status FROM software_assets WHERE software_status IS NOT NULL AND software_status <> '' ORDER BY software_status",
    )
    const statuses = statusRows.map((row) => row.software_status)
    SOFTWARE_STATUSES.forEach((status) => {
      if (!statuses.some((entry) => entry.toLowerCase() === status.toLowerCase())) statuses.push(status)
    })

    res.json({
      items,
      summary,
      filters: {
        statuses,
        licenceTypes: LICENCE_TYPES,
      },
    })
  } catch (error) {
    next(error)
  }
})

router.get('/template', (req, res, next) => {
  try {
    const buffer = buildSamTemplate()
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.set('Content-Disposition', 'attachment; filename="SAM-Software-Template.xlsx"')
    res.send(buffer)
  } catch (error) {
    next(error)
  }
})

async function readUpload(req) {
  const file = req.file
  if (!file) throw new HttpError(422, 'Choose an Excel file to upload')
  if (!isAcceptedSamFile(file.originalname)) {
    throw new HttpError(422, 'Only .xlsx and .xls files are supported for SAM uploads')
  }
  const sheets = parseSamWorkbook(file.buffer, file.originalname)
  return { file, sheets }
}

async function existingDedupeKeys() {
  const rows = await query('SELECT dedupe_key FROM software_assets WHERE dedupe_key IS NOT NULL')
  return new Set(rows.map((row) => row.dedupe_key))
}

router.post('/import/preview', requireAdmin, upload.single('file'), async (req, res, next) => {
  try {
    const { file, sheets } = await readUpload(req)
    const analysis = analyseSamSheet({
      sheets,
      fileName: file.originalname,
      existingKeys: await existingDedupeKeys(),
    })
    const rows = analysis.rows.slice(0, 200)
    res.json({ ...analysis, rows, rowsTruncated: analysis.rows.length > rows.length })
  } catch (error) {
    next(error)
  }
})

router.post('/import/commit', requireAdmin, upload.single('file'), async (req, res, next) => {
  try {
    const { file, sheets } = await readUpload(req)
    const analysis = analyseSamSheet({
      sheets,
      fileName: file.originalname,
      existingKeys: await existingDedupeKeys(),
    })

    if (analysis.missingColumns.length) {
      return res.status(422).json({
        error: `Missing required column${analysis.missingColumns.length === 1 ? '' : 's'}: ${analysis.missingColumns.join(', ')}`,
      })
    }

    const importable = analysis.rows.filter((row) => row.valid && !row.duplicate)
    if (!importable.length) {
      return res.status(422).json({ error: 'No valid new rows were found in this file' })
    }

    const vendorRows = await query('SELECT id, name FROM vendors')
    const vendors = new Map(vendorRows.map((row) => [String(row.name).toLowerCase(), row.id]))
    const now = new Date().toISOString()
    const userId = req.user.id

    await tx(async (db) => {
      for (const row of importable) {
        const values = row.values
        await db.query(
          `INSERT INTO software_assets (id, name, purchased_date, expiry_date, vendor_id, vendor_name, licence_type,
             licence_quantity, software_status, remarks, source, raw_row, dedupe_key, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            values.name,
            values.purchasedDate,
            values.expiryDate,
            values.vendorName ? vendors.get(values.vendorName.toLowerCase()) || null : null,
            values.vendorName,
            null,
            null,
            values.softwareStatus,
            null,
            'excel',
            JSON.stringify({ sheet: analysis.sheetName, values: row.raw }),
            dedupeKeyForSoftware(values),
            userId,
            now,
            now,
          ],
        )
      }
    })

    const summary = await samStatistics()
    res.json({
      summary: {
        total: analysis.summary.total,
        imported: importable.length,
        duplicates: analysis.summary.duplicates,
        invalid: analysis.summary.invalid,
      },
      statistics: summary,
    })
  } catch (error) {
    if (/unique|duplicate/i.test(String(error.message))) {
      return res.status(409).json({ error: 'Some rows already exist in the SAM register. Nothing was imported.' })
    }
    next(error)
  }
})

async function vendorIdFor(name) {
  if (!name) return null
  const vendor = await one('SELECT id FROM vendors WHERE LOWER(name) = ?', [name.toLowerCase()])
  return vendor?.id || null
}

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { record, errors } = normalizeSoftware(req.body || {})
    if (Object.keys(errors).length) {
      return res.status(422).json({ error: Object.values(errors)[0], fields: errors })
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    try {
      await query(
        `INSERT INTO software_assets (id, name, purchased_date, expiry_date, vendor_id, vendor_name, licence_type,
           licence_quantity, software_status, remarks, source, raw_row, dedupe_key, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          record.name,
          record.purchasedDate,
          record.expiryDate,
          await vendorIdFor(record.vendorName),
          record.vendorName,
          record.licenceType,
          record.licenceQuantity,
          record.softwareStatus,
          record.remarks,
          'manual',
          null,
          record.dedupeKey,
          req.user.id,
          now,
          now,
        ],
      )
    } catch (error) {
      if (/unique|duplicate/i.test(String(error.message))) {
        return res.status(409).json({ error: 'A software record with this name and purchase/expiry dates already exists' })
      }
      throw error
    }

    const created = await one('SELECT * FROM software_assets WHERE id = ?', [id])
    res.status(201).json({ item: shape(created) })
  } catch (error) {
    next(error)
  }
})

router.patch('/:id', requireAdmin, async (req, res, next) => {
  try {
    const existing = await one('SELECT * FROM software_assets WHERE id = ?', [req.params.id])
    if (!existing) throw new HttpError(404, 'Software record not found')

    const merged = {
      name: req.body.name ?? existing.name,
      purchasedDate: req.body.purchasedDate ?? existing.purchased_date,
      expiryDate: req.body.expiryDate ?? existing.expiry_date,
      vendorName: req.body.vendorName ?? existing.vendor_name,
      licenceType: req.body.licenceType ?? existing.licence_type,
      licenceQuantity: req.body.licenceQuantity ?? existing.licence_quantity,
      softwareStatus: req.body.softwareStatus ?? existing.software_status,
      remarks: req.body.remarks ?? existing.remarks,
    }

    const { record, errors } = normalizeSoftware(merged)
    if (Object.keys(errors).length) {
      return res.status(422).json({ error: Object.values(errors)[0], fields: errors })
    }

    const clash = await one('SELECT id FROM software_assets WHERE dedupe_key = ? AND id <> ?', [record.dedupeKey, existing.id])
    if (clash) return res.status(409).json({ error: 'Another software record already uses this name and dates' })

    await query(
      `UPDATE software_assets SET name = ?, purchased_date = ?, expiry_date = ?, vendor_id = ?, vendor_name = ?,
         licence_type = ?, licence_quantity = ?, software_status = ?, remarks = ?, dedupe_key = ?, updated_at = ?
       WHERE id = ?`,
      [
        record.name,
        record.purchasedDate,
        record.expiryDate,
        await vendorIdFor(record.vendorName),
        record.vendorName,
        record.licenceType,
        record.licenceQuantity,
        record.softwareStatus,
        record.remarks,
        record.dedupeKey,
        new Date().toISOString(),
        existing.id,
      ],
    )

    const updated = await one('SELECT * FROM software_assets WHERE id = ?', [existing.id])
    res.json({ item: shape(updated) })
  } catch (error) {
    next(error)
  }
})

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const existing = await one('SELECT id FROM software_assets WHERE id = ?', [req.params.id])
    if (!existing) throw new HttpError(404, 'Software record not found')
    await query('DELETE FROM software_assets WHERE id = ?', [existing.id])
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

export default router

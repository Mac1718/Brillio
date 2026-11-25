import express from 'express'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import multer from 'multer'
import { config } from '../config.js'
import { one, query, tx } from '../db.js'
import { authenticate, requireAdmin, requireWrite } from '../auth.js'
import { analyseWorkbook, isAcceptedFileName, summarise, toPreviewPayload } from '../lib/excel.js'
import { HttpError } from '../lib/http.js'
import { canonicalAssessmentStatus, normalizeAssessment } from '../lib/validate.js'

const router = express.Router()
router.use(authenticate)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1 },
})

const shape = (row) => ({
  id: row.id,
  assetId: row.asset_id,
  serial: row.serial,
  name: row.name,
  category: row.category,
  brand: row.brand,
  model: row.model,
  quantity: row.quantity,
  employee: row.employee,
  department: row.department,
  location: row.location,
  assetStatus: row.asset_status,
  purchaseDate: row.purchase_date,
  price: row.price,
  currentValue: row.current_value,
  warrantyStart: row.warranty_start,
  warrantyEnd: row.warranty_end,
  storage: row.storage,
  storageType: row.storage_type,
  ram: row.ram,
  processor: row.processor,
  os: row.os,
  vendorId: row.vendor_id,
  vendorName: row.vendor_name,
  vendorCity: row.vendor_city || null,
  vendorState: row.vendor_state || null,
  assessmentDate: row.assessment_date,
  assessmentYear: row.assessment_year,
  assessmentQuarter: row.assessment_quarter,
  assessmentStatus: row.assessment_status,
  notes: row.notes,
  source: row.source,
  importId: row.import_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const BASE_SELECT = `
  SELECT a.*, v.city AS vendor_city, v.state AS vendor_state
  FROM assessments a
  LEFT JOIN vendors v ON v.id = a.vendor_id
`

function buildFilters(query_) {
  const clauses = []
  const params = []
  const search = String(query_.search || '').trim()
  if (search) {
    clauses.push('(LOWER(a.asset_id) LIKE ? OR LOWER(a.serial) LIKE ? OR LOWER(a.name) LIKE ? OR LOWER(a.employee) LIKE ? OR LOWER(a.vendor_name) LIKE ? OR LOWER(a.department) LIKE ?)')
    const like = `%${search.toLowerCase()}%`
    params.push(like, like, like, like, like, like)
  }
  if (query_.year) {
    clauses.push('a.assessment_year = ?')
    params.push(Number(query_.year))
  }
  if (query_.quarter) {
    clauses.push('a.assessment_quarter = ?')
    params.push(String(query_.quarter).toUpperCase())
  }
  if (query_.status) {
    clauses.push('a.assessment_status = ?')
    params.push(String(query_.status))
  }
  if (query_.vendorId) {
    clauses.push('a.vendor_id = ?')
    params.push(String(query_.vendorId))
  }
  if (query_.city) {
    clauses.push('v.city = ?')
    params.push(String(query_.city))
  }
  if (query_.source) {
    clauses.push('a.source = ?')
    params.push(String(query_.source))
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params }
}

router.get('/years', async (req, res, next) => {
  try {
    const rows = await query('SELECT DISTINCT assessment_year AS year FROM assessments ORDER BY assessment_year DESC')
    res.json({ years: rows.map((row) => Number(row.year)).filter((year) => Number.isFinite(year)) })
  } catch (error) {
    next(error)
  }
})

router.get('/filters', async (req, res, next) => {
  try {
    const [vendors, cities, statuses, years] = await Promise.all([
      query("SELECT id, name FROM vendors ORDER BY name ASC"),
      query('SELECT DISTINCT city FROM vendors WHERE city IS NOT NULL ORDER BY city ASC'),
      query('SELECT DISTINCT assessment_status AS status FROM assessments'),
      query('SELECT DISTINCT assessment_year AS year FROM assessments ORDER BY assessment_year DESC'),
    ])
    res.json({
      vendors: vendors.map((row) => ({ id: row.id, name: row.name })),
      cities: cities.map((row) => row.city),
      statuses: statuses.map((row) => row.status).filter(Boolean),
      years: years.map((row) => Number(row.year)).filter(Number.isFinite),
    })
  } catch (error) {
    next(error)
  }
})

router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1)
    const pageSize = Math.min(200, Math.max(5, Number(req.query.pageSize) || 25))
    const { where, params } = buildFilters(req.query)

    const totalRow = await one(
      `SELECT COUNT(*) AS total FROM assessments a LEFT JOIN vendors v ON v.id = a.vendor_id ${where}`,
      params,
    )
    const rows = await query(
      `${BASE_SELECT} ${where} ORDER BY a.assessment_date DESC, a.asset_id ASC LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize],
    )

    res.json({
      items: rows.map(shape),
      total: Number(totalRow?.total || 0),
      page,
      pageSize,
    })
  } catch (error) {
    next(error)
  }
})

router.get('/imports', requireAdmin, async (req, res, next) => {
  try {
    const rows = await query('SELECT * FROM imports ORDER BY created_at DESC LIMIT 50')
    res.json({
      items: rows.map((row) => ({
        id: row.id,
        fileName: row.file_name,
        fileSize: row.file_size,
        sheetName: row.sheet_name,
        rowCount: row.row_count,
        importedCount: row.imported_count,
        duplicateCount: row.duplicate_count,
        invalidCount: row.invalid_count,
        warnings: row.warnings ? JSON.parse(row.warnings) : [],
        importedBy: row.imported_by,
        createdAt: row.created_at,
      })),
    })
  } catch (error) {
    next(error)
  }
})

async function vendorIndex() {
  const rows = await query('SELECT id, name, city FROM vendors')
  const map = new Map()
  rows.forEach((row) => {
    map.set(String(row.name).trim().toLowerCase(), row)
  })
  return map
}

async function existingKeysFor(keys) {
  const found = new Set()
  const unique = [...new Set(keys.filter(Boolean))]
  for (let index = 0; index < unique.length; index += 400) {
    const chunk = unique.slice(index, index + 400)
    const placeholders = chunk.map(() => '?').join(', ')
    const rows = await query(`SELECT dedupe_key FROM assessments WHERE dedupe_key IN (${placeholders})`, chunk)
    rows.forEach((row) => found.add(row.dedupe_key))
  }
  return found
}

function fileGate(req) {
  if (!req.file) throw new HttpError(400, 'Choose an .xlsx, .xls or .csv file to upload')
  if (!isAcceptedFileName(req.file.originalname)) throw new HttpError(422, 'Only .xlsx, .xls and .csv files are supported')
  if (!req.file.size) throw new HttpError(422, 'The uploaded file is empty')
}

function parseOverrides(raw) {
  if (!raw) return {}
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    throw new HttpError(422, 'Column overrides could not be read')
  }
}

router.post('/import/preview', requireWrite, upload.single('file'), async (req, res, next) => {
  try {
    fileGate(req)
    const overrides = parseOverrides(req.body?.overrides)
    const analysis = analyseWorkbook(req.file.buffer, { fileName: req.file.originalname, overrides })
    const existing = await existingKeysFor(analysis.rows.map((row) => row.record.dedupeKey))
    const vendors = await vendorIndex()
    const payload = toPreviewPayload(analysis, existing)
    payload.unmatchedVendors = analysis.vendorNames.filter((name) => !vendors.has(String(name).trim().toLowerCase()))
    res.json(payload)
  } catch (error) {
    next(error)
  }
})

router.post('/import/commit', requireWrite, upload.single('file'), async (req, res, next) => {
  try {
    fileGate(req)
    const overrides = parseOverrides(req.body?.overrides)
    const analysis = analyseWorkbook(req.file.buffer, { fileName: req.file.originalname, overrides })
    const existing = await existingKeysFor(analysis.rows.map((row) => row.record.dedupeKey))
    const summary = summarise(analysis.rows, existing)
    if (summary.valid === 0) {
      return res.status(422).json({
        error: 'Nothing could be imported',
        summary,
        missingMandatory: analysis.missingMandatory,
      })
    }

    const vendors = await vendorIndex()
    const importId = crypto.randomUUID()
    const extension = path.extname(req.file.originalname).toLowerCase()
    const storedName = `${importId}${extension}`
    fs.writeFileSync(path.join(config.uploadDir, storedName), req.file.buffer)

    const now = new Date().toISOString()
    let imported = 0
    const unmatched = new Set()

    await tx(async (scoped) => {
      for (const row of analysis.rows) {
        if (!row.valid || existing.has(row.record.dedupeKey)) continue
        const record = row.record
        const vendor = record.vendorName ? vendors.get(String(record.vendorName).trim().toLowerCase()) : null
        if (record.vendorName && !vendor) unmatched.add(record.vendorName)
        await scoped.query(
          `INSERT INTO assessments (
             id, asset_id, serial, name, category, brand, model, quantity, employee, department,
             location, asset_status, purchase_date, price, current_value, warranty_start,
             warranty_end, storage, storage_type, ram, processor, os, vendor_id, vendor_name,
             assessment_date, assessment_year, assessment_quarter, assessment_status, notes,
             source, import_id, raw_row, dedupe_key, created_by, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            record.assetId,
            record.serial,
            record.name,
            record.category,
            record.brand,
            record.model,
            record.quantity,
            record.employee,
            record.department,
            record.location,
            record.assetStatus,
            record.purchaseDate,
            record.price,
            record.currentValue,
            record.warrantyStart,
            record.warrantyEnd,
            record.storage,
            record.storageType,
            record.ram,
            record.processor,
            record.os,
            vendor?.id || null,
            record.vendorName,
            record.assessmentDate,
            record.assessmentYear,
            record.assessmentQuarter,
            record.assessmentStatus,
            record.notes,
            'excel',
            importId,
            JSON.stringify(row.raw),
            record.dedupeKey,
            req.user.id,
            now,
            now,
          ],
        )
        imported += 1
      }

      const warnings = analysis.rows.flatMap((row) => row.warnings).slice(0, 50)
      await scoped.query(
        `INSERT INTO imports (id, file_name, file_size, stored_path, sheet_name, assessment_date_column,
           row_count, imported_count, duplicate_count, invalid_count, warnings, imported_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          importId,
          req.file.originalname,
          req.file.size,
          storedName,
          analysis.sheetName,
          analysis.mapping.assessmentDate != null ? String(analysis.mapping.assessmentDate) : null,
          summary.total,
          imported,
          summary.duplicates,
          summary.invalid,
          JSON.stringify(warnings),
          req.user.id,
          now,
        ],
      )

      for (const [kind, sheet] of Object.entries({ tickets: analysis.extras.tickets, maintenance: analysis.extras.maintenance })) {
        if (!sheet) continue
        await scoped.query('INSERT INTO import_sheets (id, import_id, kind, sheet_name, payload) VALUES (?, ?, ?, ?, ?)', [
          crypto.randomUUID(),
          importId,
          kind,
          sheet.sheetName,
          JSON.stringify({ sheetName: sheet.sheetName, headers: sheet.headers, mapping: sheet.mapping, rows: sheet.rows }),
        ])
      }
    })

    res.status(201).json({
      importId,
      summary: { ...summary, imported },
      unmatchedVendors: [...unmatched],
      sheetName: analysis.sheetName,
    })
  } catch (error) {
    next(error)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const row = await one(`${BASE_SELECT} WHERE a.id = ?`, [req.params.id])
    if (!row) return res.status(404).json({ error: 'Assessment not found' })
    res.json({ item: shape(row) })
  } catch (error) {
    next(error)
  }
})

router.post('/', requireWrite, async (req, res, next) => {
  try {
    const { record, errors } = normalizeAssessment(req.body || {}, { source: 'manual' })
    if (errors.length) return res.status(422).json({ error: errors[0], errors })

    const vendor = record.vendorName
      ? await one('SELECT id FROM vendors WHERE LOWER(name) = ?', [record.vendorName.toLowerCase()])
      : null
    const now = new Date().toISOString()
    const id = crypto.randomUUID()

    try {
      await query(
        `INSERT INTO assessments (
           id, asset_id, serial, name, category, brand, model, quantity, employee, department,
           location, asset_status, purchase_date, price, current_value, warranty_start,
           warranty_end, storage, storage_type, ram, processor, os, vendor_id, vendor_name,
           assessment_date, assessment_year, assessment_quarter, assessment_status, notes,
           source, import_id, raw_row, dedupe_key, created_by, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          record.assetId,
          record.serial,
          record.name,
          record.category,
          record.brand,
          record.model,
          record.quantity,
          record.employee,
          record.department,
          record.location,
          record.assetStatus,
          record.purchaseDate,
          record.price,
          record.currentValue,
          record.warrantyStart,
          record.warrantyEnd,
          record.storage,
          record.storageType,
          record.ram,
          record.processor,
          record.os,
          vendor?.id || null,
          record.vendorName,
          record.assessmentDate,
          record.assessmentYear,
          record.assessmentQuarter,
          record.assessmentStatus,
          record.notes,
          'manual',
          null,
          null,
          record.dedupeKey,
          req.user.id,
          now,
          now,
        ],
      )
    } catch (error) {
      if (/unique|duplicate/i.test(String(error.message))) {
        return res.status(409).json({ error: 'An assessment for this asset on this date already exists' })
      }
      throw error
    }

    const created = await one(`${BASE_SELECT} WHERE a.id = ?`, [id])
    res.status(201).json({ item: shape(created) })
  } catch (error) {
    next(error)
  }
})

router.patch('/:id', requireWrite, async (req, res, next) => {
  try {
    const existing = await one('SELECT * FROM assessments WHERE id = ?', [req.params.id])
    if (!existing) return res.status(404).json({ error: 'Assessment not found' })

    const merged = {
      assetId: req.body.assetId ?? existing.asset_id,
      serial: req.body.serial ?? existing.serial,
      name: req.body.name ?? existing.name,
      category: req.body.category ?? existing.category,
      brand: req.body.brand ?? existing.brand,
      model: req.body.model ?? existing.model,
      quantity: req.body.quantity ?? existing.quantity,
      employee: req.body.employee ?? existing.employee,
      department: req.body.department ?? existing.department,
      location: req.body.location ?? existing.location,
      assetStatus: req.body.assetStatus ?? existing.asset_status,
      purchaseDate: req.body.purchaseDate ?? existing.purchase_date,
      price: req.body.price ?? existing.price,
      currentValue: req.body.currentValue ?? existing.current_value,
      warrantyStart: req.body.warrantyStart ?? existing.warranty_start,
      warrantyEnd: req.body.warrantyEnd ?? existing.warranty_end,
      storage: req.body.storage ?? existing.storage,
      storageType: req.body.storageType ?? existing.storage_type,
      ram: req.body.ram ?? existing.ram,
      processor: req.body.processor ?? existing.processor,
      os: req.body.os ?? existing.os,
      vendorName: req.body.vendorName ?? existing.vendor_name,
      assessmentDate: req.body.assessmentDate ?? existing.assessment_date,
      assessmentStatus: req.body.assessmentStatus ?? existing.assessment_status,
      notes: req.body.notes ?? existing.notes,
    }

    const { record, errors } = normalizeAssessment(merged, { source: existing.source || 'manual' })
    if (errors.length) return res.status(422).json({ error: errors[0], errors })

    const clash = await one('SELECT id FROM assessments WHERE dedupe_key = ? AND id <> ?', [record.dedupeKey, existing.id])
    if (clash) return res.status(409).json({ error: 'Another assessment already exists for this asset on this date' })

    const vendor = record.vendorName
      ? await one('SELECT id FROM vendors WHERE LOWER(name) = ?', [record.vendorName.toLowerCase()])
      : null

    await query(
      `UPDATE assessments SET asset_id = ?, serial = ?, name = ?, category = ?, brand = ?, model = ?, quantity = ?,
         employee = ?, department = ?, location = ?, asset_status = ?, purchase_date = ?, price = ?, current_value = ?,
         warranty_start = ?, warranty_end = ?, storage = ?, storage_type = ?, ram = ?, processor = ?, os = ?,
         vendor_id = ?, vendor_name = ?, assessment_date = ?, assessment_year = ?, assessment_quarter = ?,
         assessment_status = ?, notes = ?, dedupe_key = ?, updated_at = ?
       WHERE id = ?`,
      [
        record.assetId,
        record.serial,
        record.name,
        record.category,
        record.brand,
        record.model,
        record.quantity,
        record.employee,
        record.department,
        record.location,
        record.assetStatus,
        record.purchaseDate,
        record.price,
        record.currentValue,
        record.warrantyStart,
        record.warrantyEnd,
        record.storage,
        record.storageType,
        record.ram,
        record.processor,
        record.os,
        vendor?.id || null,
        record.vendorName,
        record.assessmentDate,
        record.assessmentYear,
        record.assessmentQuarter,
        record.assessmentStatus,
        record.notes,
        record.dedupeKey,
        new Date().toISOString(),
        existing.id,
      ],
    )

    const updated = await one(`${BASE_SELECT} WHERE a.id = ?`, [existing.id])
    res.json({ item: shape(updated) })
  } catch (error) {
    next(error)
  }
})

router.delete('/:id', requireWrite, async (req, res, next) => {
  try {
    const existing = await one('SELECT id FROM assessments WHERE id = ?', [req.params.id])
    if (!existing) return res.status(404).json({ error: 'Assessment not found' })
    await query('DELETE FROM assessments WHERE id = ?', [existing.id])
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

export { shape as shapeAssessment, canonicalAssessmentStatus }
export default router

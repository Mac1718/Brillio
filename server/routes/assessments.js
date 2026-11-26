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
import { classificationFromPoDate, normalizeAssessment } from '../lib/validate.js'
import { findAmbiguousVendor, normalizeVendorName, similarityPercent } from '../lib/vendors.js'

const router = express.Router()
router.use(authenticate)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1 },
})

const shape = (row) => {
  // Year and quarter are always read back through the PO Date; records that
  // predate the PO Date rule keep their stored values and are flagged.
  const classification = classificationFromPoDate(row.po_date)
  return {
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
  assessmentYear: classification?.year ?? null,
  assessmentQuarter: classification?.quarter ?? null,
  assessmentStatus: row.assessment_status,
  notes: row.notes,
  // standard 21-column structure
  costType: row.cost_type,
  projectId: row.project_id,
  projectName: row.project_name,
  memo: row.memo,
  bau: row.bau,
  remarks: row.remarks,
  costQ1: row.cost_q1,
  costQ2: row.cost_q2,
  costQ3: row.cost_q3,
  costQ4: row.cost_q4,
  totalBudgetFy: row.total_budget_fy,
  spendFy: row.spend_fy,
  savings: row.savings,
  excess: row.excess,
  po: row.po,
  poDate: row.po_date,
  pr: row.pr,
  prDate: row.pr_date,
  poDateMissing: !row.po_date,
  source: row.source,
  importId: row.import_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  }
}

const BASE_SELECT = `
  SELECT a.*, v.city AS vendor_city, v.state AS vendor_state
  FROM assessments a
  LEFT JOIN vendors v ON v.id = a.vendor_id
`

const INSERT_COLUMNS = [
  'id', 'asset_id', 'serial', 'name', 'category', 'brand', 'model', 'quantity', 'employee', 'department',
  'location', 'asset_status', 'purchase_date', 'price', 'current_value', 'warranty_start', 'warranty_end',
  'storage', 'storage_type', 'ram', 'processor', 'os', 'vendor_id', 'vendor_name',
  'assessment_year', 'assessment_quarter', 'assessment_status', 'notes',
  'cost_type', 'project_id', 'project_name', 'memo', 'bau', 'remarks',
  'cost_q1', 'cost_q2', 'cost_q3', 'cost_q4', 'total_budget_fy', 'spend_fy', 'savings', 'excess',
  'po', 'po_date', 'pr', 'pr_date',
  'source', 'import_id', 'raw_row', 'dedupe_key', 'created_by', 'created_at', 'updated_at',
]

const INSERT_SQL = `INSERT INTO assessments (${INSERT_COLUMNS.join(', ')}) VALUES (${INSERT_COLUMNS.map(() => '?').join(', ')})`

function insertValues({ id, record, vendorId, source, importId, rawRow, dedupeKey, userId, now }) {
  return [
    id,
    record.assetId, record.serial, record.name, record.category, record.brand, record.model, record.quantity,
    record.employee, record.department, record.location, record.assetStatus, record.purchaseDate, record.price,
    record.currentValue, record.warrantyStart, record.warrantyEnd, record.storage, record.storageType, record.ram,
    record.processor, record.os, vendorId, record.vendorName,
    record.assessmentYear, record.assessmentQuarter, record.assessmentStatus, record.notes,
    record.costType, record.projectId, record.projectName, record.memo, record.bau, record.remarks,
    record.costQ1, record.costQ2, record.costQ3, record.costQ4, record.totalBudgetFy, record.spendFy,
    record.savings, record.excess, record.po, record.poDate, record.pr, record.prDate,
    source, importId, rawRow, dedupeKey, userId, now, now,
  ]
}

const UPDATE_SQL = `
  UPDATE assessments SET
    asset_id = ?, serial = ?, name = ?, category = ?, brand = ?, model = ?, quantity = ?, employee = ?,
    department = ?, location = ?, asset_status = ?, purchase_date = ?, price = ?, current_value = ?,
    warranty_start = ?, warranty_end = ?, storage = ?, storage_type = ?, ram = ?, processor = ?, os = ?,
    vendor_id = ?, vendor_name = ?, assessment_year = ?, assessment_quarter = ?,
    assessment_status = ?, notes = ?, cost_type = ?, project_id = ?, project_name = ?, memo = ?, bau = ?,
    remarks = ?, cost_q1 = ?, cost_q2 = ?, cost_q3 = ?, cost_q4 = ?, total_budget_fy = ?, spend_fy = ?,
    savings = ?, excess = ?, po = ?, po_date = ?, pr = ?, pr_date = ?, dedupe_key = ?, updated_at = ?
  WHERE id = ?
`

const updateValues = (record, vendorId, dedupeKey, now, id) => [
  record.assetId, record.serial, record.name, record.category, record.brand, record.model, record.quantity,
  record.employee, record.department, record.location, record.assetStatus, record.purchaseDate, record.price,
  record.currentValue, record.warrantyStart, record.warrantyEnd, record.storage, record.storageType, record.ram,
  record.processor, record.os, vendorId, record.vendorName,
  record.assessmentYear, record.assessmentQuarter, record.assessmentStatus, record.notes,
  record.costType, record.projectId, record.projectName, record.memo, record.bau, record.remarks,
  record.costQ1, record.costQ2, record.costQ3, record.costQ4, record.totalBudgetFy, record.spendFy,
  record.savings, record.excess, record.po, record.poDate, record.pr, record.prDate,
  dedupeKey, now, id,
]

function buildFilters(query_) {
  const clauses = []
  const params = []
  const search = String(query_.search || '').trim()
  if (search) {
    clauses.push(
      '(LOWER(a.asset_id) LIKE ? OR LOWER(a.serial) LIKE ? OR LOWER(a.name) LIKE ? OR LOWER(a.employee) LIKE ? OR LOWER(a.vendor_name) LIKE ? OR LOWER(a.department) LIKE ? OR LOWER(a.project_id) LIKE ? OR LOWER(a.project_name) LIKE ? OR LOWER(a.memo) LIKE ?)',
    )
    const like = `%${search.toLowerCase()}%`
    params.push(like, like, like, like, like, like, like, like, like)
  }
  // Reporting periods are derived from the stored PO Date, the single source
  // of truth, so filters cannot disagree with the dashboards.
  if (query_.year) {
    clauses.push("CAST(substr(a.po_date, 1, 4) AS INTEGER) = ?")
    params.push(Number(query_.year))
  }
  if (query_.quarter) {
    clauses.push("('Q' || CAST((CAST(substr(a.po_date, 6, 2) AS INTEGER) + 2) / 3 AS INTEGER)) = ?")
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
  if (query_.department) {
    clauses.push('LOWER(COALESCE(a.department, \'\')) = ?')
    params.push(String(query_.department).toLowerCase())
  }
  if (query_.source) {
    clauses.push('a.source = ?')
    params.push(String(query_.source))
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params }
}

router.get('/years', async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT DISTINCT CAST(substr(po_date, 1, 4) AS INTEGER) AS year
       FROM assessments
       WHERE po_date IS NOT NULL AND po_date <> ''
       ORDER BY year DESC`,
    )
    res.json({ years: rows.map((row) => Number(row.year)).filter((year) => Number.isFinite(year)) })
  } catch (error) {
    next(error)
  }
})

router.get('/filters', async (req, res, next) => {
  try {
    const [vendors, cities, statuses, years, departments, projects, categories, costTypes] = await Promise.all([
      query('SELECT id, name FROM vendors ORDER BY name ASC'),
      query('SELECT DISTINCT city FROM vendors WHERE city IS NOT NULL ORDER BY city ASC'),
      query('SELECT DISTINCT assessment_status AS status FROM assessments'),
      query(
        `SELECT DISTINCT CAST(substr(po_date, 1, 4) AS INTEGER) AS year
         FROM assessments
         WHERE po_date IS NOT NULL AND po_date <> ''
         ORDER BY year DESC`,
      ),
      query("SELECT DISTINCT department FROM assessments WHERE department IS NOT NULL AND department <> '' ORDER BY department ASC"),
      query("SELECT DISTINCT project_id, project_name FROM assessments WHERE project_id IS NOT NULL AND project_id <> '' ORDER BY project_id ASC"),
      query("SELECT DISTINCT category FROM assessments WHERE category IS NOT NULL AND category <> '' ORDER BY category ASC"),
      query("SELECT DISTINCT cost_type FROM assessments WHERE cost_type IS NOT NULL AND cost_type <> '' ORDER BY cost_type ASC"),
    ])
    res.json({
      vendors: vendors.map((row) => ({ id: row.id, name: row.name })),
      cities: cities.map((row) => row.city),
      statuses: statuses.map((row) => row.status).filter(Boolean),
      years: years.map((row) => Number(row.year)).filter(Number.isFinite),
      departments: departments.map((row) => row.department),
      projects: projects.map((row) => ({ id: row.project_id, name: row.project_name })),
      categories: categories.map((row) => row.category),
      costTypes: costTypes.map((row) => row.cost_type),
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
      `${BASE_SELECT} ${where} ORDER BY COALESCE(a.po_date, '') DESC, a.created_at DESC, a.asset_id ASC LIMIT ? OFFSET ?`,
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
        vendorsMatched: row.vendors_matched,
        vendorsCreated: row.vendors_created,
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
  const rows = await query('SELECT id, name, name_normalized, city, state FROM vendors')
  const map = new Map()
  rows.forEach((row) => {
    map.set(row.name_normalized || normalizeVendorName(row.name), row)
  })
  return map
}

/**
 * Compares the vendor names in an uploaded file with the master list without
 * writing anything. Existing vendors are matched on the normalised name;
 * close-but-different spellings are surfaced for review, never merged.
 */
function buildVendorSummary(analysis, vendors) {
  const existing = []
  const existingByVendor = new Map()
  const create = []
  const duplicates = []
  const ambiguous = []
  const masterNames = [...vendors.values()].map((vendor) => vendor.name)

  for (const entry of analysis.vendorNameCounts || []) {
    const name = entry.name
    const key = normalizeVendorName(name)
    const match = vendors.get(key)
    if (match) {
      const current = existingByVendor.get(match.id)
      if (current) {
        current.count += entry.count
        if (current.excelName !== name) current.variants.push(name)
      } else {
        const record = { excelName: name, vendorName: match.name, vendorId: match.id, count: entry.count, variants: [] }
        existingByVendor.set(match.id, record)
        existing.push(record)
      }
    } else {
      create.push({ name, count: entry.count })
      const near = findAmbiguousVendor(name, masterNames)
      if (near) {
        ambiguous.push({
          name,
          similarTo: near.name,
          similarity: similarityPercent(near.score),
          count: entry.count,
        })
      }
    }
    if (entry.count > 1) duplicates.push({ name, count: entry.count })
  }

  return {
    existing,
    create,
    duplicates,
    ambiguous,
    missingVendorNames: analysis.missingVendorName || 0,
    matchedCount: existing.length,
    createCount: create.length,
  }
}

async function ensureVendor(scoped, displayName, userId, now, cache) {
  const key = normalizeVendorName(displayName)
  if (cache.has(key)) return { vendor: cache.get(key), created: false }

  const found = await scoped.query('SELECT id, name, city, state FROM vendors WHERE name_normalized = ?', [key])
  if (found.length) {
    cache.set(key, found[0])
    return { vendor: found[0], created: false }
  }

  const id = crypto.randomUUID()
  // ON CONFLICT protects against two uploads racing to create the same vendor.
  await scoped.query(
    `INSERT INTO vendors (id, name, name_normalized, city, state, created_at, updated_at, created_by)
     VALUES (?, ?, ?, '', '', ?, ?, ?)
     ON CONFLICT (name_normalized) DO NOTHING`,
    [id, displayName, key, now, now, userId],
  )
  const rows = await scoped.query('SELECT id, name, city, state FROM vendors WHERE name_normalized = ?', [key])
  const vendor = rows[0] || { id, name: displayName, city: '', state: '' }
  cache.set(key, vendor)
  return { vendor, created: rows[0]?.id === id }
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

function duplicateGate(analysis) {
  const exact = analysis.duplicates?.exact || []
  if (exact.length) {
    const detail = exact.map((entry) => `“${entry.columns.join('” and “')}”`).join('; ')
    throw new HttpError(422, `Duplicate columns after normalisation: ${detail}. Rename or remove one of each pair before importing.`)
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
    const vendorSummary = buildVendorSummary(analysis, vendors)
    payload.vendorSummary = vendorSummary
    payload.unmatchedVendors = vendorSummary.create.map((entry) => entry.name)
    payload.canImport = (analysis.duplicates?.exact || []).length === 0
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
    duplicateGate(analysis)

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
    const matchedVendors = new Set()
    const createdVendors = new Set()
    const preExistingKeys = new Set(vendors.keys())
    const vendorSummary = buildVendorSummary(analysis, vendors)

    await tx(async (scoped) => {
      for (const row of analysis.rows) {
        if (!row.valid || existing.has(row.record.dedupeKey)) continue
        const record = row.record
        let vendorId = null
        if (record.vendorName) {
          const result = await ensureVendor(scoped, record.vendorName, req.user.id, now, vendors)
          vendorId = result.vendor?.id || null
          if (result.created) createdVendors.add(result.vendor.name)
          else if (result.vendor && preExistingKeys.has(normalizeVendorName(result.vendor.name))) {
            matchedVendors.add(result.vendor.name)
          }
        }
        await scoped.query(
          INSERT_SQL,
          insertValues({
            id: crypto.randomUUID(),
            record,
            vendorId,
            source: 'excel',
            importId,
            rawRow: JSON.stringify(row.raw),
            dedupeKey: record.dedupeKey,
            userId: req.user.id,
            now,
          }),
        )
        imported += 1
      }

      const warnings = analysis.rows.flatMap((row) => row.warnings).slice(0, 50)
      if (analysis.standard?.missing?.length) {
        warnings.push(`Missing standard columns: ${analysis.standard.missing.map((field) => field.label).join(', ')}`)
      }
      if (vendorSummary.ambiguous.length) {
        warnings.push(
          `Possible vendor name variations flagged for review: ${vendorSummary.ambiguous
            .map((entry) => `${entry.name} (similar to ${entry.similarTo})`)
            .join(', ')}`,
        )
      }
      await scoped.query(
        `INSERT INTO imports (id, file_name, file_size, stored_path, sheet_name,
           row_count, imported_count, duplicate_count, invalid_count, warnings, imported_by, created_at,
           vendors_matched, vendors_created)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          importId,
          req.file.originalname,
          req.file.size,
          storedName,
          analysis.sheetName,
          summary.total,
          imported,
          summary.duplicates,
          summary.invalid,
          JSON.stringify(warnings),
          req.user.id,
          now,
          matchedVendors.size,
          createdVendors.size,
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
      standard: analysis.standard,
      vendorSummary: {
        ...vendorSummary,
        matched: [...matchedVendors],
        created: [...createdVendors],
        matchedCount: matchedVendors.size,
        createCount: createdVendors.size,
      },
      unmatchedVendors: [...createdVendors],
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
      ? await one('SELECT id FROM vendors WHERE name_normalized = ?', [normalizeVendorName(record.vendorName)])
      : null
    const now = new Date().toISOString()
    const id = crypto.randomUUID()

    try {
      await query(
        INSERT_SQL,
        insertValues({
          id,
          record,
          vendorId: vendor?.id || null,
          source: 'manual',
          importId: null,
          rawRow: null,
          dedupeKey: record.dedupeKey,
          userId: req.user.id,
          now,
        }),
      )
    } catch (error) {
      if (/unique|duplicate/i.test(String(error.message))) {
        return res.status(409).json({ error: 'An assessment for this asset or project on this date already exists' })
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
      assessmentStatus: req.body.assessmentStatus ?? existing.assessment_status,
      notes: req.body.notes ?? existing.notes,
      costType: req.body.costType ?? existing.cost_type,
      projectId: req.body.projectId ?? existing.project_id,
      projectName: req.body.projectName ?? existing.project_name,
      memo: req.body.memo ?? existing.memo,
      bau: req.body.bau ?? existing.bau,
      remarks: req.body.remarks ?? existing.remarks,
      costQ1: req.body.costQ1 ?? existing.cost_q1,
      costQ2: req.body.costQ2 ?? existing.cost_q2,
      costQ3: req.body.costQ3 ?? existing.cost_q3,
      costQ4: req.body.costQ4 ?? existing.cost_q4,
      totalBudgetFy: req.body.totalBudgetFy ?? existing.total_budget_fy,
      spendFy: req.body.spendFy ?? existing.spend_fy,
      savings: req.body.savings ?? existing.savings,
      excess: req.body.excess ?? existing.excess,
      po: req.body.po ?? existing.po,
      poDate: req.body.poDate ?? existing.po_date,
      pr: req.body.pr ?? existing.pr,
      prDate: req.body.prDate ?? existing.pr_date,
    }

    const { record, errors } = normalizeAssessment(merged, { source: existing.source || 'manual' })
    if (errors.length) return res.status(422).json({ error: errors[0], errors })

    const clash = await one('SELECT id FROM assessments WHERE dedupe_key = ? AND id <> ?', [record.dedupeKey, existing.id])
    if (clash) return res.status(409).json({ error: 'Another assessment already exists for this asset or project with this PO Date' })

    const vendor = record.vendorName
      ? await one('SELECT id FROM vendors WHERE name_normalized = ?', [normalizeVendorName(record.vendorName)])
      : null

    await query(
      UPDATE_SQL,
      updateValues(record, vendor?.id || null, record.dedupeKey, new Date().toISOString(), existing.id),
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

export { shape as shapeAssessment }
export default router

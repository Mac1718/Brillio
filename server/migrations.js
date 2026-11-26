import { exec, one, query } from './db.js'
import { normalizeVendorName } from './lib/vendors.js'
import { dedupeKeyFor } from './lib/validate.js'

const migrations = [
  {
    id: '001_init',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email);

      CREATE TABLE IF NOT EXISTS vendors (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        address TEXT,
        contact_person TEXT,
        email TEXT,
        phone TEXT,
        category TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS vendors_name_city_unique ON vendors (name, city);
      CREATE INDEX IF NOT EXISTS vendors_city ON vendors (city);

      CREATE TABLE IF NOT EXISTS imports (
        id TEXT PRIMARY KEY,
        file_name TEXT NOT NULL,
        file_size INTEGER NOT NULL DEFAULT 0,
        stored_path TEXT,
        sheet_name TEXT,
        assessment_date_column TEXT,
        row_count INTEGER NOT NULL DEFAULT 0,
        imported_count INTEGER NOT NULL DEFAULT 0,
        duplicate_count INTEGER NOT NULL DEFAULT 0,
        invalid_count INTEGER NOT NULL DEFAULT 0,
        warnings TEXT,
        imported_by TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS import_sheets (
        id TEXT PRIMARY KEY,
        import_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        sheet_name TEXT,
        payload TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS assessments (
        id TEXT PRIMARY KEY,
        asset_id TEXT,
        serial TEXT,
        name TEXT,
        category TEXT,
        brand TEXT,
        model TEXT,
        quantity INTEGER,
        employee TEXT,
        department TEXT,
        location TEXT,
        asset_status TEXT,
        purchase_date TEXT,
        price REAL,
        current_value REAL,
        warranty_start TEXT,
        warranty_end TEXT,
        storage TEXT,
        storage_type TEXT,
        ram TEXT,
        processor TEXT,
        os TEXT,
        vendor_id TEXT,
        vendor_name TEXT,
        assessment_date TEXT NOT NULL,
        assessment_year INTEGER NOT NULL,
        assessment_quarter TEXT NOT NULL,
        assessment_status TEXT NOT NULL,
        notes TEXT,
        source TEXT NOT NULL,
        import_id TEXT,
        raw_row TEXT,
        dedupe_key TEXT NOT NULL,
        created_by TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS assessments_dedupe_unique ON assessments (dedupe_key);
      CREATE INDEX IF NOT EXISTS assessments_year_quarter ON assessments (assessment_year, assessment_quarter);
      CREATE INDEX IF NOT EXISTS assessments_status ON assessments (assessment_status);
      CREATE INDEX IF NOT EXISTS assessments_vendor ON assessments (vendor_id);
      CREATE INDEX IF NOT EXISTS assessments_date ON assessments (assessment_date);
    `,
  },
  {
    id: '002_assessment_standard_fields',
    sql: `
      ALTER TABLE assessments ADD COLUMN cost_type TEXT;
      ALTER TABLE assessments ADD COLUMN project_id TEXT;
      ALTER TABLE assessments ADD COLUMN project_name TEXT;
      ALTER TABLE assessments ADD COLUMN memo TEXT;
      ALTER TABLE assessments ADD COLUMN bau TEXT;
      ALTER TABLE assessments ADD COLUMN remarks TEXT;
      ALTER TABLE assessments ADD COLUMN cost_q1 REAL;
      ALTER TABLE assessments ADD COLUMN cost_q2 REAL;
      ALTER TABLE assessments ADD COLUMN cost_q3 REAL;
      ALTER TABLE assessments ADD COLUMN cost_q4 REAL;
      ALTER TABLE assessments ADD COLUMN total_budget_fy REAL;
      ALTER TABLE assessments ADD COLUMN spend_fy REAL;
      ALTER TABLE assessments ADD COLUMN savings REAL;
      ALTER TABLE assessments ADD COLUMN excess REAL;
      ALTER TABLE assessments ADD COLUMN po TEXT;
      ALTER TABLE assessments ADD COLUMN po_date TEXT;
      ALTER TABLE assessments ADD COLUMN pr TEXT;
      ALTER TABLE assessments ADD COLUMN pr_date TEXT;
      CREATE INDEX IF NOT EXISTS assessments_project ON assessments (project_id);
      CREATE INDEX IF NOT EXISTS assessments_department ON assessments (department);
    `,
  },
  {
    id: '003_software_assets',
    sql: `
      CREATE TABLE IF NOT EXISTS software_assets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        purchased_date TEXT,
        expiry_date TEXT NOT NULL,
        vendor_id TEXT,
        vendor_name TEXT,
        licence_type TEXT,
        licence_quantity INTEGER,
        software_status TEXT,
        remarks TEXT,
        dedupe_key TEXT NOT NULL,
        created_by TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS software_assets_dedupe_unique ON software_assets (dedupe_key);
      CREATE INDEX IF NOT EXISTS software_assets_expiry ON software_assets (expiry_date);
      CREATE INDEX IF NOT EXISTS software_assets_vendor ON software_assets (vendor_id);
    `,
  },
  {
    id: '004_sam_import_metadata',
    sql: `
      ALTER TABLE software_assets ADD COLUMN source TEXT;
      ALTER TABLE software_assets ADD COLUMN raw_row TEXT;
    `,
  },
  {
    // Vendor identity is a normalised name so "NetConnect Solutions",
    // "NETCONNECT SOLUTIONS" and "  NetConnect   Solutions " resolve to one
    // master record. Existing duplicates are folded into the oldest record
    // and their assessments are re-pointed before the unique index is added.
    id: '006_vendor_master_sync',
    async run() {
      const addColumn = async (statement) => {
        try {
          await exec(statement)
        } catch (error) {
          if (!/duplicate column|already exists/i.test(String(error.message))) throw error
        }
      }
      await addColumn('ALTER TABLE vendors ADD COLUMN name_normalized TEXT')
      await addColumn('ALTER TABLE imports ADD COLUMN vendors_matched INTEGER NOT NULL DEFAULT 0')
      await addColumn('ALTER TABLE imports ADD COLUMN vendors_created INTEGER NOT NULL DEFAULT 0')

      const rows = await query('SELECT id, name, created_at FROM vendors ORDER BY created_at ASC, id ASC')
      const keepByNormalized = new Map()
      for (const row of rows) {
        const key = normalizeVendorName(row.name)
        if (!key) continue
        if (keepByNormalized.has(key)) {
          const keeperId = keepByNormalized.get(key)
          await query('UPDATE assessments SET vendor_id = ? WHERE vendor_id = ?', [keeperId, row.id])
          await query('DELETE FROM vendors WHERE id = ?', [row.id])
        } else {
          keepByNormalized.set(key, row.id)
          await query('UPDATE vendors SET name_normalized = ? WHERE id = ?', [key, row.id])
        }
      }
      await exec('CREATE UNIQUE INDEX IF NOT EXISTS vendors_name_normalized_unique ON vendors (name_normalized)')
    },
  },
  {
    // PO Date became the single source of truth for the reporting year and
    // quarter. Reclassify stored records from their stored PO Date; records
    // with no PO Date keep their previous classification and are flagged in
    // the app rather than being given an invented quarter.
    id: '005_po_date_classification',
    sql: `
      UPDATE assessments
      SET assessment_year = CAST(substr(po_date, 1, 4) AS INTEGER),
          assessment_quarter = 'Q' || CAST((CAST(substr(po_date, 6, 2) AS INTEGER) + 2) / 3 AS INTEGER)
      WHERE po_date IS NOT NULL
        AND length(po_date) >= 10
        AND substr(po_date, 5, 1) = '-';
    `,
  },
  {
    // Assessments imported before vendor master sync store only the vendor name
    // text. Link them to a master vendor record (creating a location-less one)
    // so vendor-wise reporting reads the relationship for every record.
    id: '007_backfill_assessment_vendors',
    async run() {
      const rows = await query(
        'SELECT id, vendor_name FROM assessments WHERE vendor_id IS NULL AND vendor_name IS NOT NULL',
      )
      const now = new Date().toISOString()
      const vendorIdByKey = new Map()
      for (const row of rows) {
        const displayName = String(row.vendor_name || '').trim()
        const key = normalizeVendorName(displayName)
        if (!key) continue
        if (!vendorIdByKey.has(key)) {
          const existing = await query('SELECT id FROM vendors WHERE name_normalized = ?', [key])
          let vendorId = existing[0]?.id
          if (!vendorId) {
            vendorId = crypto.randomUUID()
            await query(
              `INSERT INTO vendors (id, name, name_normalized, city, state, created_at, updated_at)
               VALUES (?, ?, ?, '', '', ?, ?)
               ON CONFLICT (name_normalized) DO NOTHING`,
              [vendorId, displayName, key, now, now],
            )
            vendorId = (await query('SELECT id FROM vendors WHERE name_normalized = ?', [key]))[0].id
          }
          vendorIdByKey.set(key, vendorId)
        }
        await query('UPDATE assessments SET vendor_id = ? WHERE id = ?', [vendorIdByKey.get(key), row.id])
      }
    },
  },
  {
    // The register has no Assessment Date column, so it is dropped with its
    // index. Duplicate identity is now the asset/project plus its PO Date, so
    // stored keys are recomputed before the column goes away.
    id: '008_remove_assessment_date',
    async run() {
      const rows = await query('SELECT id, asset_id, serial, project_id, memo, po_date, dedupe_key FROM assessments')
      const seen = new Set()
      for (const row of rows) {
        if (!row.asset_id && !row.serial && !row.project_id && !row.memo) continue
        const key = dedupeKeyFor({
          assetId: row.asset_id,
          serial: row.serial,
          projectId: row.project_id,
          memo: row.memo,
          poDate: row.po_date,
        })
        // A collision keeps the row's existing key so the unique index holds.
        if (seen.has(key)) continue
        seen.add(key)
        if (key !== row.dedupe_key) await query('UPDATE assessments SET dedupe_key = ? WHERE id = ?', [key, row.id])
      }
      await exec('DROP INDEX IF EXISTS assessments_date')
      await exec('ALTER TABLE assessments DROP COLUMN assessment_date')
      try {
        await exec('ALTER TABLE imports DROP COLUMN assessment_date_column')
      } catch (error) {
        if (!/no such column/i.test(String(error.message))) throw error
      }
    },
  },
  {
    // Resolved city coordinates are cached so every vendor city in the master
    // list can be placed on the map without repeated geocoding, and new cities
    // resolve automatically when they are first used.
    id: '009_city_locations',
    sql: `
      CREATE TABLE IF NOT EXISTS city_locations (
        id TEXT PRIMARY KEY,
        city_key TEXT NOT NULL,
        state_key TEXT NOT NULL,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        source TEXT NOT NULL,
        resolved_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS city_locations_unique ON city_locations (city_key, state_key);
      CREATE INDEX IF NOT EXISTS city_locations_city ON city_locations (city_key);
    `,
  },
]

export async function migrate() {
  await exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `)

  for (const migration of migrations) {
    const applied = await one('SELECT id FROM schema_migrations WHERE id = ?', [migration.id])
    if (applied) continue
    if (migration.run) await migration.run()
    else await exec(migration.sql)
    await query('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)', [migration.id, new Date().toISOString()])
    console.log(`[brillo] applied migration ${migration.id}`)
  }
}

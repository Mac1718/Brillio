import { exec, one, query } from './db.js'

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
    await exec(migration.sql)
    await query('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)', [migration.id, new Date().toISOString()])
    console.log(`[brillo] applied migration ${migration.id}`)
  }
}

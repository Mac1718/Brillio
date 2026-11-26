# brillo — IT Assessment Management

Enterprise IT assessment tracking: role-based access, Excel and manual assessment entry, vendor management with an interactive India map, and quarterly/yearly analytics derived from each record's own PO Date.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite 6, Tailwind 4, Recharts, Lucide |
| Backend | Node.js, Express 4, REST API |
| Auth | JWT in an httpOnly cookie, bcrypt password hashing (cost 12) |
| Database | SQLite via `node:sqlite` (zero native build) **or** PostgreSQL via `pg` |
| Files | Uploaded workbooks stored on disk under `UPLOAD_DIR` |

The React app and the API deploy as one container. In development Vite proxies `/api` to the server, so no host is hardcoded anywhere.

## Quick start (local)

```bash
npm install
cp .env.example .env          # optional: defaults work for local development
npm run dev:api               # API on http://localhost:4000 (creates SQLite DB + migrations)
npm run dev                   # UI on http://localhost:5199 (proxies /api)
```

Open http://localhost:5199 and sign in. There is **no public signup**: accounts exist only when an administrator creates them.

### First administrator

Provision the first Admin through the environment, never through source code:

```bash
BOOTSTRAP_ADMIN_EMAIL=you@company.com
BOOTSTRAP_ADMIN_PASSWORD=<a strong password from your secret store>
```

The server creates that account **only while the users table is empty**, then ignores the variables. After that, every account — including other admins — is created by an Admin on the **Create Users** page.

Production build and single-process serve:

```bash
npm run build
NODE_ENV=production JWT_SECRET="$(openssl rand -hex 32)" npm start   # http://localhost:4000
```

## Roles

| Capability | Admin | Manager | User |
| --- | --- | --- | --- |
| View dashboard, assessments, vendors, reports | yes | yes | yes |
| Excel import, manual add/edit/delete | yes | no | no |
| Vendor create/edit/delete | yes | no | no |
| Create users, manage users, assign roles | yes | no | no |
| Access admin modules | yes | no | no |

Permissions are enforced by middleware on every protected API route (`server/auth.js`), not only by hiding interface controls. The session is re-checked against the database on each request, so disabling an account or changing a role takes effect immediately.

## Data model

| Table | Purpose |
| --- | --- |
| `users` | Account, bcrypt hash, role, active flag |
| `vendors` | Vendor master with city/state (drives the map) |
| `city_locations` | Cached coordinates for resolved vendor cities |
| `assessments` | One row per assessed asset with `po_date` and `assessment_year` / `assessment_quarter` derived from `po_date` |
| `imports` | Import history: file, counts, duplicates, invalid rows, warnings |
| `import_sheets` | Supporting worksheets (support tickets, maintenance) from the latest workbook |
| `schema_migrations` | Applied migration ids |

`assessments.dedupe_key` is a unique SHA-256 of `asset_id | serial | po_date` (project/memo in place of the asset identity for project rows). The same asset with the same PO Date is rejected on import and on manual entry, so repeat uploads cannot create duplicate records.

### PO Date is the single source of truth

`assessment_year` and `assessment_quarter` are always computed from the record's **PO Date** on the server — never from the upload time, the record creation time, the PR Date or a "current quarter" default. Q1 = Jan–Mar, Q2 = Apr–Jun, Q3 = Jul–Sep, Q4 = Oct–Dec. A missing or unreadable PO Date fails validation with a per-row error; the row is not imported and no quarter is guessed. Reports, filters and dashboards derive the period from the stored PO Date, and records without one are excluded from quarterly/yearly totals and flagged in the UI.

The Cost Q1–Q4, Total Budget FY, Spend FY, Savings and Excess fields are recorded amounts and are never recalculated from the PO Date.

## Vendor map and city resolution

The India map is database-driven. Every distinct city/state in the vendor master is resolved server-side against a bundled GeoNames dataset of Indian populated places (all towns with a population of 1,000+ plus every administrative seat, with alternate names such as Bangalore/Bengaluru). Resolved coordinates are cached in `city_locations`, so a city is resolved once and reused.

- Alias spellings resolve to one canonical city, so Bangalore and Bengaluru share a single marker and combined vendor count.
- A state is used to disambiguate repeated city names; a city in the wrong state is left unmapped for Admin review rather than pinned at a guess.
- Vendors with no city/state, or a city that cannot be resolved, appear under Unmapped Locations until an Admin corrects them.
- Adding or editing a vendor resolves its city immediately; deleting the last vendor in a city removes its marker. No hardcoded city list exists in the frontend.

Accepted date inputs: real Excel date cells, Excel serial numbers, `YYYY-MM-DD`, and `DD/MM/YYYY` / `DD-MM-YYYY` text (day-first), plus `DD Mon YYYY`.

## Excel requirements

Mandatory for import: **one identity column** (Asset ID or Serial Number) and a **PO Date** column. Everything else is optional and is stored as provided.

If a workbook has no PO date column, the preview reports it as missing and offers a column picker so the right column can be mapped explicitly. Headers themselves are detected automatically using the synonym list in `src/lib/fields.js` (shared by the browser and the server).

The application ships with no business data: no assessments, vendors, software records, projects, amounts or sample charts. Every dashboard, report, chart and map starts at zero and populates only from a workbook an Admin imports or records entered manually. A fresh database contains accounts and schema only.

## API

All routes are JSON and require a session cookie except `POST /api/auth/login`, `POST /api/auth/logout` and `GET /api/health`. There is no registration endpoint; `/api/users` is administrator-only for reads and writes.

```
POST   /api/auth/login             POST   /api/auth/logout      GET /api/auth/me
PATCH  /api/auth/profile           POST   /api/auth/change-password
GET    /api/users                  POST   /api/users            PATCH /api/users/:id    DELETE /api/users/:id
GET    /api/assessments            POST   /api/assessments      PATCH /api/assessments/:id   DELETE /api/assessments/:id
GET    /api/assessments/filters    GET    /api/assessments/years     GET /api/assessments/imports
POST   /api/assessments/import/preview    POST /api/assessments/import/commit
GET    /api/vendors                POST   /api/vendors          PATCH /api/vendors/:id  DELETE /api/vendors/:id
GET    /api/software               POST   /api/software         PATCH /api/software/:id  DELETE /api/software/:id
POST   /api/software/import/preview       POST /api/software/import/commit       GET /api/software/template
GET    /api/analytics              GET    /api/dataset
POST   /api/admin/clear-data       (Admin only, body { confirm: "CLEAR" })
GET    /api/health
```

`import/preview` parses and validates the workbook and returns per-row status without writing anything. `import/commit` re-validates server-side, writes valid non-duplicate rows inside a transaction, records the import and stores the file. Importing never deletes existing records; `POST /api/admin/clear-data` is the separate, explicitly confirmed way for an Admin to remove all business records while keeping accounts, roles and schema.

## Configuration

See `.env.example`. Everything is environment-driven: `PORT`, `JWT_SECRET`, `DATABASE_URL`, `DATABASE_SSL`, `DATA_DIR`, `UPLOAD_DIR`, `MAX_UPLOAD_MB`, `CORS_ORIGIN`, `COOKIE_SECURE`, `BOOTSTRAP_ADMIN_*`.

`JWT_SECRET` is mandatory in production — the server refuses to start with the development default.

## Docker

```bash
cp .env.example .env
# set POSTGRES_PASSWORD and JWT_SECRET in .env
docker compose up --build
```

The compose file runs PostgreSQL 16 with a named volume and the app container with a volume for uploaded files, so records and files survive restarts and redeploys. Migrations run at startup.

For a single-container SQLite deployment, omit `DATABASE_URL` and mount `DATA_DIR` on persistent storage.

## Cloud notes

- **Azure**: App Service (Linux container) or Container Apps + Azure Database for PostgreSQL + Azure Files mounted at `/app/data/uploads`. Set `COOKIE_SECURE=true` behind HTTPS and `DATABASE_SSL=true` for managed Postgres.
- **AWS**: ECS Fargate + RDS PostgreSQL + EFS, or App Runner. Same environment variables.
- **GCP**: Cloud Run + Cloud SQL PostgreSQL + a GCS/Filestore mount.
- Horizontal scaling: set `DATABASE_URL` to PostgreSQL and mount a shared upload volume; the app holds no in-memory state.

## Project layout

```
server/            Express API
  db.js            SQLite/Postgres adapter, transactions
  migrations.js    Versioned schema
  auth.js          Hashing, JWT, role guards
  lib/excel.js     Workbook parsing, preview, validation
  lib/validate.js  Shared assessment validation + quarter logic
  routes/          auth, users, assessments, vendors, analytics, dataset
src/               React app
  auth/            Session context
  components/      Sidebar, Topbar, IndiaMap, ImportPanel, tables
  pages/           Login, Overview, Assessments, Analytics, Vendors, Users, …
  lib/             API client, record mapping, field synonyms, city coordinates
```

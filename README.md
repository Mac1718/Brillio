# brillo — IT Assessment Management

Enterprise IT assessment tracking: role-based access, Excel and manual assessment entry, vendor management with an interactive India map, and quarterly/yearly analytics derived from each record's own assessment date.

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

Open http://localhost:5199 and **create the first account — it becomes the administrator**. Every later signup is a read-only `user` until an admin raises the role. Alternatively set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` in `.env` to have the administrator created at startup.

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
| User management, role assignment | yes | no | no |
| Access admin modules | yes | no | no |

Permissions are enforced by middleware on every protected API route (`server/auth.js`), not only by hiding interface controls. The session is re-checked against the database on each request, so disabling an account or changing a role takes effect immediately.

## Data model

| Table | Purpose |
| --- | --- |
| `users` | Account, bcrypt hash, role, active flag |
| `vendors` | Vendor master with city/state (drives the map) |
| `assessments` | One row per assessed asset with `assessment_date`, `assessment_year`, `assessment_quarter` |
| `imports` | Import history: file, counts, duplicates, invalid rows, warnings |
| `import_sheets` | Supporting worksheets (support tickets, maintenance) from the latest workbook |
| `schema_migrations` | Applied migration ids |

`assessments.dedupe_key` is a unique SHA-256 of `asset_id | serial | assessment_date`. The same asset assessed twice on the same date is rejected on import and on manual entry, so repeat uploads cannot create duplicate records.

### Assessment date is the single source of truth

`assessment_year` and `assessment_quarter` are always computed from the record's assessment date on the server — never from the upload time, the record creation time, or a "current quarter" default. Q1 = Jan–Mar, Q2 = Apr–Jun, Q3 = Jul–Sep, Q4 = Oct–Dec. A missing or unreadable date fails validation with a per-row error; the row is not imported and no quarter is guessed.

Accepted date inputs: real Excel date cells, Excel serial numbers, `YYYY-MM-DD`, and `DD/MM/YYYY` / `DD-MM-YYYY` text (day-first), plus `DD Mon YYYY`.

## Excel requirements

Mandatory for import: **one identity column** (Asset ID or Serial Number) and an **Assessment Date** column. Everything else is optional and is stored as provided.

If a workbook has no assessment date column, the preview reports it as missing and offers a column picker so the right column can be mapped explicitly. Headers themselves are detected automatically using the synonym list in `src/lib/fields.js` (shared by the browser and the server).

> The bundled `public/IT-Asset-Sample.xlsx` is demonstration data and has **no** assessment date column, so it is rejected by design until a date column is mapped. Use it to verify validation, not to populate the database.

## API

All routes are JSON and require a session cookie except `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout` and `GET /api/health`.

```
POST   /api/auth/signup            POST   /api/auth/login       POST /api/auth/logout   GET /api/auth/me
GET    /api/users                  POST   /api/users            PATCH /api/users/:id    DELETE /api/users/:id
GET    /api/assessments            POST   /api/assessments      PATCH /api/assessments/:id   DELETE /api/assessments/:id
GET    /api/assessments/filters    GET    /api/assessments/years     GET /api/assessments/imports
POST   /api/assessments/import/preview    POST /api/assessments/import/commit
GET    /api/vendors                POST   /api/vendors          PATCH /api/vendors/:id  DELETE /api/vendors/:id
GET    /api/analytics              GET    /api/dataset
GET    /api/health
```

`import/preview` parses and validates the workbook and returns per-row status without writing anything. `import/commit` re-validates server-side, writes valid non-duplicate rows inside a transaction, records the import and stores the file.

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

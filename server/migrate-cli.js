import { closeDb, initDb, getDialect } from './db.js'
import { migrate } from './migrations.js'

try {
  await initDb()
  await migrate()
  console.log(`[brillo] migrations up to date (${getDialect()})`)
  await closeDb()
  process.exit(0)
} catch (error) {
  console.error('[brillo] migration failed', error)
  process.exit(1)
}

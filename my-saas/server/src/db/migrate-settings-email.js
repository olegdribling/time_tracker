const pool = require('./index')

async function migrate() {
  await pool.query(`
    ALTER TABLE settings
      ADD COLUMN IF NOT EXISTS user_email TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS accountant_email TEXT NOT NULL DEFAULT ''
  `)
  console.log('settings email columns OK')
  process.exit(0)
}

migrate().catch(err => { console.error(err); process.exit(1) })

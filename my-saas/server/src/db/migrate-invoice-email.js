const pool = require('./index')

async function migrate() {
  await pool.query(`
    ALTER TABLE invoice_profiles
    ADD COLUMN IF NOT EXISTS my_email TEXT NOT NULL DEFAULT ''
  `)
  console.log('invoice_profiles.my_email column OK')
  process.exit(0)
}

migrate().catch(err => { console.error(err); process.exit(1) })

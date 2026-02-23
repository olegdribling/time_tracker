const pool = require('./index')

async function migrate() {
  await pool.query(`
    ALTER TABLE shifts
    ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL
  `)
  console.log('shifts.client_id column OK')
  process.exit(0)
}

migrate().catch(err => { console.error(err); process.exit(1) })

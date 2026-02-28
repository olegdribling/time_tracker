const pool = require('./index')

async function migrate() {
  await pool.query(`
    ALTER TABLE settings
      ADD COLUMN IF NOT EXISTS weekend_rate_enabled BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS weekend_rate NUMERIC(10,2) NOT NULL DEFAULT 0
  `)
  console.log('weekend_rate columns added')

  await pool.query(`
    ALTER TABLE settings
      DROP COLUMN IF EXISTS user_email,
      DROP COLUMN IF EXISTS accountant_email
  `)
  console.log('user_email, accountant_email columns dropped')

  process.exit(0)
}

migrate().catch(err => { console.error(err); process.exit(1) })

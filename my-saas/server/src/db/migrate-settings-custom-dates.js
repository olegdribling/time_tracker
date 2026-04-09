require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const pool = require('../db')

async function migrate() {
  await pool.query(`
    ALTER TABLE settings
      ADD COLUMN IF NOT EXISTS custom_date_from DATE,
      ADD COLUMN IF NOT EXISTS custom_date_to DATE;
  `)
  console.log('Migration done')
  process.exit(0)
}

migrate().catch(e => { console.error(e); process.exit(1) })

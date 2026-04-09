require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const pool = require('../db')

async function migrate() {
  await pool.query(`
    ALTER TABLE invoice_profiles
      ADD COLUMN IF NOT EXISTS gst_mode VARCHAR(20) DEFAULT 'none',
      ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10,2) DEFAULT 25,
      ADD COLUMN IF NOT EXISTS weekend_rate_enabled BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS weekend_rate NUMERIC(10,2) DEFAULT 25;
    UPDATE invoice_profiles
      SET gst_mode = CASE WHEN charge_gst = true THEN 'exclusive' ELSE 'none' END
      WHERE gst_mode = 'none';
  `)
  console.log('Migration done')
  process.exit(0)
}

migrate().catch(e => { console.error(e); process.exit(1) })

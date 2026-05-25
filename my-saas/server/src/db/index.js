const { Pool, types } = require('pg')
require('dotenv').config()

// Return DATE columns as plain "YYYY-MM-DD" strings instead of Date objects.
// Without this, pg converts DATE to a JS Date at midnight in the DB server's
// local timezone (Neon = AEST/UTC+10), so "2026-05-25" becomes
// "2026-05-24T14:00:00Z" and .split('T')[0] gives the wrong day.
types.setTypeParser(types.builtins.DATE, (val) => val)

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  keepAlive: true,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
})

pool.on('error', (err) => {
  console.error('Unexpected pool error', err)
})

module.exports = pool
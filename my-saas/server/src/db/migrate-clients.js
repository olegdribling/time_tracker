const pool = require('./index')

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      full_name  TEXT NOT NULL DEFAULT '',
      company_name TEXT NOT NULL DEFAULT '',
      address    TEXT NOT NULL DEFAULT '',
      abn        TEXT NOT NULL DEFAULT '',
      email      TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  console.log('clients table OK')
  process.exit(0)
}

migrate().catch(err => { console.error(err); process.exit(1) })

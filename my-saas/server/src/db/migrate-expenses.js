const pool = require('./index')

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      vendor TEXT,
      amount NUMERIC(10,2) NOT NULL,
      gst NUMERIC(10,2) NOT NULL DEFAULT 0,
      category TEXT NOT NULL,
      expense_date DATE NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  console.log('expenses table OK')
  process.exit(0)
}

migrate().catch(err => { console.error(err); process.exit(1) })

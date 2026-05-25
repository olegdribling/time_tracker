require('dotenv').config()
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: '/home/u673267555/domains/invairo.com.au/public_html/.builds/config/.env' })
}
const pool = require('../db')

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      invoice_number TEXT NOT NULL,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      client_snapshot JSONB NOT NULL,
      line_items JSONB NOT NULL,
      subtotal NUMERIC(10,2) NOT NULL,
      gst NUMERIC(10,2) NOT NULL DEFAULT 0,
      total NUMERIC(10,2) NOT NULL,
      gst_mode TEXT NOT NULL DEFAULT 'none',
      status TEXT NOT NULL DEFAULT 'sent',
      issued_date DATE NOT NULL,
      comments TEXT,
      period_start DATE,
      period_end DATE,
      profile_snapshot JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  console.log('invoices table created')
  await pool.end()
}

migrate().catch(err => { console.error(err); process.exit(1) })

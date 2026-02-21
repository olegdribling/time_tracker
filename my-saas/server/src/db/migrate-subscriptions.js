const pool = require('./index')

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id                    SERIAL PRIMARY KEY,
      user_id               INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      stripe_customer_id    TEXT,
      stripe_subscription_id TEXT,
      plan                  TEXT NOT NULL DEFAULT 'trial',
      trial_ends_at         TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
      current_period_end    TIMESTAMPTZ,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  console.log('subscriptions table OK')
  process.exit(0)
}

migrate().catch(err => { console.error(err); process.exit(1) })

const express = require('express')
const pool = require('../db')
const authMiddleware = require('../middleware/auth')
const router = express.Router()

router.use(authMiddleware)

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM settings WHERE user_id=$1', [req.userId])
    if (!result.rows.length) return res.json(null)
    const row = result.rows[0]
    res.json({
      period: row.period,
      weekStart: row.week_start,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.put('/', async (req, res) => {
  const { period, weekStart } = req.body
  try {
    await pool.query(
      `INSERT INTO settings (user_id, period, week_start)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET
         period=EXCLUDED.period, week_start=EXCLUDED.week_start, updated_at=NOW()`,
      [req.userId, period, weekStart]
    )
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router

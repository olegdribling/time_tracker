const express = require('express')
const pool = require('../db')
const authMiddleware = require('../middleware/auth')
const router = express.Router()

router.use(authMiddleware)

const rowToShift = (row) => ({
  id: row.id,
  date: (row.date instanceof Date ? row.date.toISOString() : String(row.date)).split('T')[0],
  start: row.start_time,
  end: row.end_time,
  lunchMinutes: row.lunch_minutes,
  comment: row.comment,
  hourlyRate: parseFloat(row.hourly_rate),
  clientId: row.client_id ?? null,
})

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM shifts WHERE user_id=$1 ORDER BY date DESC',
      [req.userId]
    )
    res.json(result.rows.map(rowToShift))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/', async (req, res) => {
  const { id, date, start, end, lunchMinutes, comment, hourlyRate, clientId } = req.body
  try {
    await pool.query(
      `INSERT INTO shifts (id, user_id, date, start_time, end_time, lunch_minutes, comment, hourly_rate, client_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         date=EXCLUDED.date, start_time=EXCLUDED.start_time, end_time=EXCLUDED.end_time,
         lunch_minutes=EXCLUDED.lunch_minutes, comment=EXCLUDED.comment,
         hourly_rate=EXCLUDED.hourly_rate, client_id=EXCLUDED.client_id, updated_at=NOW()`,
      [id, req.userId, date, start, end, lunchMinutes, comment || '', hourlyRate, clientId ?? null]
    )
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.put('/:id', async (req, res) => {
  const { date, start, end, lunchMinutes, comment, hourlyRate, clientId } = req.body
  try {
    await pool.query(
      `UPDATE shifts SET date=$1, start_time=$2, end_time=$3, lunch_minutes=$4,
       comment=$5, hourly_rate=$6, client_id=$7, updated_at=NOW()
       WHERE id=$8 AND user_id=$9`,
      [date, start, end, lunchMinutes, comment || '', hourlyRate, clientId ?? null, req.params.id, req.userId]
    )
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM shifts WHERE id=$1 AND user_id=$2', [req.params.id, req.userId])
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router

const express = require('express')
const pool = require('../db')
const authMiddleware = require('../middleware/auth')
const router = express.Router()

router.use(authMiddleware)

const toDateStr = (v) => v ? (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10)) : null

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM invoices WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    )
    const rows = result.rows.map(row => ({
      ...row,
      issued_date: toDateStr(row.issued_date),
      period_start: toDateStr(row.period_start),
      period_end: toDateStr(row.period_end),
    }))
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/', async (req, res) => {
  const {
    invoice_number, client_id, client_snapshot, line_items,
    subtotal, gst, total, gst_mode, issued_date,
    comments, period_start, period_end, profile_snapshot,
  } = req.body
  try {
    const result = await pool.query(
      `INSERT INTO invoices
        (user_id, invoice_number, client_id, client_snapshot, line_items,
         subtotal, gst, total, gst_mode, status, issued_date,
         comments, period_start, period_end, profile_snapshot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'sent',$10,$11,$12,$13,$14)
       RETURNING id`,
      [
        req.userId, invoice_number, client_id || null,
        JSON.stringify(client_snapshot), JSON.stringify(line_items),
        subtotal, gst, total, gst_mode || 'none', issued_date,
        comments || null, period_start || null, period_end || null,
        JSON.stringify(profile_snapshot),
      ]
    )
    res.json({ id: result.rows[0].id })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.patch('/:id/status', async (req, res) => {
  const { status } = req.body
  if (!['sent', 'paid', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' })
  }
  try {
    await pool.query(
      'UPDATE invoices SET status = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3',
      [status, req.params.id, req.userId]
    )
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM invoices WHERE id = $1 AND user_id = $2', [req.params.id, req.userId])
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router

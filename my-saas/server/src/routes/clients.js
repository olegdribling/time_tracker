const express = require('express')
const pool = require('../db')
const authMiddleware = require('../middleware/auth')
const router = express.Router()

router.use(authMiddleware)

const rowToClient = (row) => ({
  id: row.id,
  fullName: row.full_name,
  companyName: row.company_name,
  address: row.address,
  abn: row.abn,
  email: row.email,
})

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM clients WHERE user_id=$1 ORDER BY id ASC',
      [req.userId]
    )
    res.json(result.rows.map(rowToClient))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/', async (req, res) => {
  const { fullName, companyName, address, abn, email } = req.body
  try {
    const result = await pool.query(
      `INSERT INTO clients (user_id, full_name, company_name, address, abn, email)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [req.userId, fullName || '', companyName || '', address || '', abn || '', email || '']
    )
    res.json({ id: result.rows[0].id })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.put('/:id', async (req, res) => {
  const { fullName, companyName, address, abn, email } = req.body
  try {
    await pool.query(
      `UPDATE clients SET full_name=$1, company_name=$2, address=$3, abn=$4, email=$5, updated_at=NOW()
       WHERE id=$6 AND user_id=$7`,
      [fullName || '', companyName || '', address || '', abn || '', email || '', req.params.id, req.userId]
    )
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM clients WHERE id=$1 AND user_id=$2', [req.params.id, req.userId])
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router

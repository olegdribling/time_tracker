const express = require('express')
const pool = require('../db')
const authMiddleware = require('../middleware/auth')
const router = express.Router()

router.use(authMiddleware)

const rowToProduct = (row) => ({
  id: row.id,
  name: row.name,
  price: parseFloat(row.price),
})

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM products WHERE user_id=$1 ORDER BY id ASC',
      [req.userId]
    )
    res.json(result.rows.map(rowToProduct))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/', async (req, res) => {
  const { name, price } = req.body
  try {
    const result = await pool.query(
      `INSERT INTO products (user_id, name, price) VALUES ($1, $2, $3) RETURNING id`,
      [req.userId, name || '', parseFloat(price) || 0]
    )
    res.json({ id: result.rows[0].id })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.put('/:id', async (req, res) => {
  const { name, price } = req.body
  try {
    await pool.query(
      `UPDATE products SET name=$1, price=$2, updated_at=NOW() WHERE id=$3 AND user_id=$4`,
      [name || '', parseFloat(price) || 0, req.params.id, req.userId]
    )
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id=$1 AND user_id=$2', [req.params.id, req.userId])
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router

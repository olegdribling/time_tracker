const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const pool = require('../db')
require('dotenv').config()

const router = express.Router()

// Регистрация
router.post('/register', async (req, res) => {
  const { email, password } = req.body
  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email])
    if (existing.rows.length > 0)
      return res.status(400).json({ error: 'Email уже занят' })

    const hash = await bcrypt.hash(password, 10)
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, hash]
    )
    const newUserId = result.rows[0].id
    // Создаём trial-подписку на 30 дней
    await pool.query(
      `INSERT INTO subscriptions (user_id, plan, trial_ends_at)
       VALUES ($1, 'trial', NOW() + INTERVAL '30 days')
       ON CONFLICT (user_id) DO NOTHING`,
      [newUserId]
    )
    const token = jwt.sign({ userId: newUserId }, process.env.JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, user: result.rows[0] })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

// Логин
router.post('/login', async (req, res) => {
  const { email, password } = req.body
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email])
    const user = result.rows[0]
    if (!user) return res.status(401).json({ error: 'Неверный email или пароль' })

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Неверный email или пароль' })

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, user: { id: user.id, email: user.email } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

// Текущий пользователь
router.get('/me', require('../middleware/auth'), async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email FROM users WHERE id = $1', [req.userId])
    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

module.exports = router
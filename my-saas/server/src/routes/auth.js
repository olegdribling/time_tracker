const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const pool = require('../db')
require('dotenv').config()

const router = express.Router()

const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex')

const makeRefreshToken = () => {
  const token = crypto.randomBytes(64).toString('hex')
  return { token, hash: hashToken(token) }
}

const storeRefreshToken = async (userId, hash) => {
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
    [userId, hash]
  )
}

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
    const accessToken = jwt.sign({ userId: newUserId }, process.env.JWT_SECRET, { expiresIn: '15m' })
    const { token: refreshToken, hash: refreshHash } = makeRefreshToken()
    await storeRefreshToken(newUserId, refreshHash)
    res.json({ token: accessToken, refreshToken, user: result.rows[0] })
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

    const accessToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '15m' })
    const { token: refreshToken, hash: refreshHash } = makeRefreshToken()
    await storeRefreshToken(user.id, refreshHash)
    res.json({ token: accessToken, refreshToken, user: { id: user.id, email: user.email } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

// Обновление токена
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body
  if (!refreshToken) return res.status(401).json({ error: 'No refresh token' })
  try {
    const hash = hashToken(refreshToken)
    const result = await pool.query(
      `SELECT * FROM refresh_tokens WHERE token_hash=$1 AND expires_at > NOW()`,
      [hash]
    )
    if (!result.rows[0]) return res.status(401).json({ error: 'Invalid or expired refresh token' })
    const { user_id } = result.rows[0]
    // Ротация: удаляем старый, создаём новый
    await pool.query('DELETE FROM refresh_tokens WHERE token_hash=$1', [hash])
    const { token: newRefresh, hash: newHash } = makeRefreshToken()
    await storeRefreshToken(user_id, newHash)
    const newAccess = jwt.sign({ userId: user_id }, process.env.JWT_SECRET, { expiresIn: '15m' })
    res.json({ token: newAccess, refreshToken: newRefresh })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

// Выход
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body
  try {
    if (refreshToken) {
      const hash = hashToken(refreshToken)
      await pool.query('DELETE FROM refresh_tokens WHERE token_hash=$1', [hash])
    }
    res.json({ ok: true })
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

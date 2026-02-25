const express = require('express')
const router = express.Router()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const pool = require('../db')
const authMiddleware = require('../middleware/auth')

const PLANS = {
  solo: {
    priceId: process.env.STRIPE_PRICE_SOLO,
    name: 'Solo',
  },
  pro: {
    priceId: process.env.STRIPE_PRICE_PRO,
    name: 'Pro',
  },
}

// GET /api/billing/status — текущий план пользователя
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM subscriptions WHERE user_id = $1',
      [req.userId]
    )
    if (!rows.length) {
      return res.json({ plan: 'trial', trial_ends_at: null, active: true })
    }
    const sub = rows[0]
    const now = new Date()

    let active = false
    if (sub.plan === 'trial') {
      active = new Date(sub.trial_ends_at) > now
    } else if (sub.plan === 'solo' || sub.plan === 'pro') {
      active = sub.current_period_end ? new Date(sub.current_period_end) > now : false
    }

    res.json({
      plan: sub.plan,
      trial_ends_at: sub.trial_ends_at,
      current_period_end: sub.current_period_end,
      active,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/billing/checkout — создать Stripe Checkout Session
router.post('/checkout', authMiddleware, async (req, res) => {
  const { plan } = req.body
  if (!PLANS[plan]) return res.status(400).json({ error: 'Invalid plan' })

  try {
    // Не создаём новую подписку если уже есть активная платная
    const existingRes = await pool.query(
      'SELECT plan, current_period_end FROM subscriptions WHERE user_id = $1',
      [req.userId]
    )
    const existing = existingRes.rows[0]
    if (existing && (existing.plan === 'solo' || existing.plan === 'pro')) {
      const isActive = existing.current_period_end && new Date(existing.current_period_end) > new Date()
      if (isActive) {
        return res.status(400).json({ error: 'Already subscribed. Use the portal to change your plan.' })
      }
    }

    const userRes = await pool.query('SELECT email FROM users WHERE id = $1', [req.userId])
    const email = userRes.rows[0]?.email

    // Найти или создать stripe customer
    let { rows } = await pool.query(
      'SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1',
      [req.userId]
    )
    let customerId = rows[0]?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({ email, metadata: { user_id: String(req.userId) } })
      customerId = customer.id
      // Если записи нет — создать
      await pool.query(
        `INSERT INTO subscriptions (user_id, stripe_customer_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET stripe_customer_id = $2, updated_at = NOW()`,
        [req.userId, customerId]
      )
    }

    const successUrl = process.env.APP_URL
      ? `${process.env.APP_URL}/app/billing?success=1`
      : 'http://localhost:5173/app/billing?success=1'
    const cancelUrl = process.env.APP_URL
      ? `${process.env.APP_URL}/app/billing?cancelled=1`
      : 'http://localhost:5173/app/billing?cancelled=1'

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: PLANS[plan].priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { user_id: String(req.userId), plan },
    })

    res.json({ url: session.url })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not create checkout session' })
  }
})

// POST /api/billing/portal — Stripe Customer Portal (управление подпиской)
router.post('/portal', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1',
      [req.userId]
    )
    const customerId = rows[0]?.stripe_customer_id
    if (!customerId) return res.status(400).json({ error: 'No billing account found' })

    const returnUrl = process.env.APP_URL
      ? `${process.env.APP_URL}/app/billing`
      : 'http://localhost:5173/app/billing'

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    })
    res.json({ url: session.url })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not open portal' })
  }
})


module.exports = router

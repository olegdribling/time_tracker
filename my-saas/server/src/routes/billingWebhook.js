const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null
const pool = require('../db')

// Stripe 2026-01-28.clover API returns timestamps as ISO strings; older versions use Unix ints
function toDate(value) {
  if (!value) return null
  if (typeof value === 'number') return new Date(value * 1000)
  return new Date(value)
}

module.exports = async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Billing not configured' })
  const sig = req.headers['stripe-signature']

  console.log('[Webhook] Request received')
  console.log('[Webhook] stripe-signature present:', !!sig)
  console.log('[Webhook] body is Buffer:', Buffer.isBuffer(req.body), '| type:', typeof req.body)

  let event
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('[Webhook] Signature verification failed:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  console.log('[Webhook] Event type:', event.type, '| ID:', event.id)

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      console.log('[Webhook] session.id:', session.id)
      console.log('[Webhook] session.metadata:', JSON.stringify(session.metadata))
      console.log('[Webhook] session.customer:', session.customer)
      console.log('[Webhook] session.subscription:', session.subscription)

      // Handle thin events: if metadata missing, retrieve full session
      let userId = session.metadata?.user_id
      let plan = session.metadata?.plan
      let customerId = session.customer
      let subscriptionId = session.subscription

      if (!userId || !plan) {
        console.log('[Webhook] Metadata missing — retrieving full session from Stripe')
        const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
          expand: ['subscription'],
        })
        userId = fullSession.metadata?.user_id
        plan = fullSession.metadata?.plan
        customerId = fullSession.customer
        subscriptionId = fullSession.subscription?.id || fullSession.subscription
        console.log('[Webhook] After retrieve — userId:', userId, 'plan:', plan)
      }

      if (userId && plan && subscriptionId) {
        const stripeSub = await stripe.subscriptions.retrieve(
          typeof subscriptionId === 'string' ? subscriptionId : subscriptionId.id
        )
        console.log('[Webhook] current_period_end raw:', stripeSub.current_period_end, '| type:', typeof stripeSub.current_period_end)
        const periodEnd = toDate(stripeSub.current_period_end)

        await pool.query(
          `INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, plan, current_period_end, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT (user_id) DO UPDATE SET
             stripe_customer_id = $2,
             stripe_subscription_id = $3,
             plan = $4,
             current_period_end = $5,
             updated_at = NOW()`,
          [userId, customerId, stripeSub.id, plan, periodEnd]
        )
        console.log('[Webhook] DB updated: user', userId, '->', plan, '| sub:', stripeSub.id)
      } else {
        console.error('[Webhook] Cannot update — missing: userId=', userId, 'plan=', plan, 'subscriptionId=', subscriptionId)
      }
    }

    if (event.type === 'customer.subscription.updated') {
      const stripeSub = event.data.object
      const periodEnd = toDate(stripeSub.current_period_end)
      const priceId = stripeSub.items.data[0]?.price?.id

      let plan = 'unknown'
      if (priceId === process.env.STRIPE_PRICE_SOLO) plan = 'solo'
      else if (priceId === process.env.STRIPE_PRICE_PRO) plan = 'pro'

      if (stripeSub.status === 'canceled' || stripeSub.cancel_at_period_end) {
        plan = 'cancelled'
      }

      console.log('[Webhook] subscription.updated:', stripeSub.id, '->', plan)
      await pool.query(
        `UPDATE subscriptions SET plan = $1, current_period_end = $2, updated_at = NOW()
         WHERE stripe_subscription_id = $3`,
        [plan, periodEnd, stripeSub.id]
      )
    }

    if (event.type === 'customer.subscription.deleted') {
      const stripeSub = event.data.object
      console.log('[Webhook] subscription.deleted:', stripeSub.id)
      await pool.query(
        `UPDATE subscriptions SET plan = 'cancelled', updated_at = NOW()
         WHERE stripe_subscription_id = $1`,
        [stripeSub.id]
      )
    }
  } catch (err) {
    console.error('[Webhook] Handler error:', err)
    return res.status(500).json({ error: 'Internal error processing webhook' })
  }

  res.json({ received: true })
}

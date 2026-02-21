const express = require('express')
const cors = require('cors')
require('dotenv').config()

const app = express()

app.use(cors())

// Webhook MUST be registered before express.json() to get raw Buffer body
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), require('./routes/billingWebhook'))

app.use(express.json())

app.use('/api/auth', require('./routes/auth'))
app.use('/api/shifts', require('./routes/shifts'))
app.use('/api/settings', require('./routes/settings'))
app.use('/api/invoice-profile', require('./routes/invoiceProfile'))
app.use('/api/billing', require('./routes/billing'))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))

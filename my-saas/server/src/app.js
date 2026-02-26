const express = require('express')
const cors = require('cors')
const path = require('path')
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
app.use('/api/clients', require('./routes/clients'))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// Serve built frontend
const distPath = path.join(__dirname, '../../../dist')
app.use(express.static(distPath))
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))

const express = require('express')
const cors = require('cors')
const path = require('path')
require('dotenv').config()
// Fallback: load env from Hostinger build config if DATABASE_URL not set (survives git clean -fdx)
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: '/home/u673267555/domains/invairo.com.au/public_html/.builds/config/.env' })
}

const app = express()

app.use(cors())

// Prevent browser from caching authenticated API responses
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

// Webhook MUST be registered before express.json() to get raw Buffer body
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), require('./routes/billingWebhook'))

app.use(express.json())

app.use('/api/auth', require('./routes/auth'))
app.use('/api/shifts', require('./routes/shifts'))
app.use('/api/settings', require('./routes/settings'))
app.use('/api/invoice-profile', require('./routes/invoiceProfile'))
app.use('/api/billing', require('./routes/billing'))
app.use('/api/clients', require('./routes/clients'))
app.use('/api/products', require('./routes/products'))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// Serve built frontend
// index.html must never be cached — JS/CSS assets have content hashes so can be cached
const distPath = path.join(__dirname, '../../../dist')
app.use(express.static(distPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.set('Cache-Control', 'no-store')
    }
  },
}))
app.get('/{*path}', (_req, res) => {
  res.set('Cache-Control', 'no-store')
  res.sendFile(path.join(distPath, 'index.html'))
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))

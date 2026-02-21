const express = require('express')
const cors = require('cors')
require('dotenv').config()

const app = express()

app.use(cors())

// Webhook нужен raw body — регистрируем до express.json()
app.use('/api/billing/webhook', require('./routes/billing'))

app.use(express.json())

app.use('/api/auth', require('./routes/auth'))
app.use('/api/shifts', require('./routes/shifts'))
app.use('/api/settings', require('./routes/settings'))
app.use('/api/invoice-profile', require('./routes/invoiceProfile'))
app.use('/api/billing', require('./routes/billing'))

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))

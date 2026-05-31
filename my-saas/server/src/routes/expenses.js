const express = require('express')
const multer = require('multer')
const Anthropic = require('@anthropic-ai/sdk')
const pool = require('../db')
const authMiddleware = require('../middleware/auth')

const router = express.Router()
router.use(authMiddleware)

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

const CATEGORIES = [
  'Vehicle & travel', 'Home office', 'Equipment', 'Software & subscriptions',
  'Marketing', 'Professional services', 'Training & education',
  'Insurance', 'Bank fees', 'Subcontractors',
]

const toDateStr = (v) => v ? (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10)) : null

const rowToExpense = (row) => ({
  id: row.id,
  vendor: row.vendor,
  amount: parseFloat(row.amount),
  gst: parseFloat(row.gst),
  category: row.category,
  expense_date: toDateStr(row.expense_date),
  description: row.description,
  created_at: row.created_at,
})

router.post('/scan', upload.single('receipt'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const today = new Date().toISOString().slice(0, 10)

  try {
    const base64 = req.file.buffer.toString('base64')
    const mediaType = req.file.mimetype || 'image/jpeg'
    const isPdf = mediaType === 'application/pdf'

    const fileContent = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
      : { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } }

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: [
            fileContent,
            {
              type: 'text',
              text: `You are a receipt parser for an Australian freelancer app.
First, determine if this image is a receipt, invoice, or financial document showing a purchase or payment.
If it is NOT a receipt or invoice, return ONLY: {"is_receipt":false}

If it IS a receipt or invoice, extract: vendor name, total amount (AUD), GST amount (AUD, 0 if not shown),
and the most appropriate expense category from this list:
${CATEGORIES.join(', ')}.

Return ONLY valid JSON (no markdown, no explanation):
{"is_receipt":true,"vendor":"...","amount":0.00,"gst":0.00,"category":"...","expense_date":"YYYY-MM-DD"}
If date not visible use today's date: ${today}. If GST not shown, set to 0.`,
            },
          ],
        },
      ],
    })

    let text = message.content[0].text.trim()
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(text)

    if (parsed.is_receipt === false) {
      return res.status(422).json({ error: 'not_a_receipt' })
    }

    if (!CATEGORIES.includes(parsed.category)) parsed.category = 'Software & subscriptions'
    if (!parsed.expense_date) parsed.expense_date = today

    res.json(parsed)
  } catch (err) {
    console.error('[expenses/scan]', err)
    res.status(500).json({ error: 'Failed to parse receipt' })
  }
})

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM expenses WHERE user_id=$1 ORDER BY expense_date DESC, created_at DESC',
      [req.userId]
    )
    res.json(result.rows.map(rowToExpense))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/', async (req, res) => {
  const { vendor, amount, gst, category, expense_date, description } = req.body
  if (!amount || !category || !expense_date) {
    return res.status(400).json({ error: 'amount, category and expense_date are required' })
  }
  try {
    const result = await pool.query(
      `INSERT INTO expenses (user_id, vendor, amount, gst, category, expense_date, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [req.userId, vendor || '', amount, gst || 0, category, expense_date, description || null]
    )
    res.json({ id: result.rows[0].id })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  if (!id) return res.status(400).json({ error: 'Invalid id' })
  const { vendor, amount, gst, category, expense_date, description } = req.body
  try {
    await pool.query(
      `UPDATE expenses SET vendor=$1, amount=$2, gst=$3, category=$4, expense_date=$5,
       description=$6, updated_at=NOW() WHERE id=$7 AND user_id=$8`,
      [vendor || '', amount, gst || 0, category, expense_date, description || null, id, req.userId]
    )
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10)
  if (!id) return res.status(400).json({ error: 'Invalid id' })
  try {
    await pool.query('DELETE FROM expenses WHERE id=$1 AND user_id=$2', [id, req.userId])
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router

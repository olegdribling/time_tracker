const express = require('express')
const pool = require('../db')
const authMiddleware = require('../middleware/auth')
const router = express.Router()

router.use(authMiddleware)

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM invoice_profiles WHERE user_id=$1', [req.userId])
    if (!result.rows.length) return res.json(null)
    const row = result.rows[0]
    res.json({
      fullName: row.full_name,
      address: row.address,
      abn: row.abn,
      speciality: row.speciality,
      accountBankName: row.account_bank_name,
      bsb: row.bsb,
      accountNumber: row.account_number,
      nextInvoiceNumber: row.next_invoice_number,
      gstMode: row.gst_mode ?? 'none',
      hourlyRate: parseFloat(row.hourly_rate) || 25,
      weekendRateEnabled: row.weekend_rate_enabled ?? false,
      weekendRate: parseFloat(row.weekend_rate) || 25,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.put('/', async (req, res) => {
  const { fullName, address, abn, speciality, accountBankName, bsb, accountNumber, nextInvoiceNumber, gstMode, hourlyRate, weekendRateEnabled, weekendRate } = req.body
  try {
    await pool.query(
      `INSERT INTO invoice_profiles
         (user_id, full_name, address, abn, speciality, account_bank_name, bsb, account_number, next_invoice_number, gst_mode, hourly_rate, weekend_rate_enabled, weekend_rate)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (user_id) DO UPDATE SET
         full_name=EXCLUDED.full_name, address=EXCLUDED.address, abn=EXCLUDED.abn,
         speciality=EXCLUDED.speciality, account_bank_name=EXCLUDED.account_bank_name,
         bsb=EXCLUDED.bsb, account_number=EXCLUDED.account_number,
         next_invoice_number=EXCLUDED.next_invoice_number, gst_mode=EXCLUDED.gst_mode,
         hourly_rate=EXCLUDED.hourly_rate, weekend_rate_enabled=EXCLUDED.weekend_rate_enabled,
         weekend_rate=EXCLUDED.weekend_rate, updated_at=NOW()`,
      [req.userId, fullName || '', address || '', abn || '', speciality || '',
       accountBankName || '', bsb || '', accountNumber || '', nextInvoiceNumber ?? 1,
       gstMode ?? 'none', hourlyRate ?? 25, weekendRateEnabled ?? false, weekendRate ?? 25]
    )
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router

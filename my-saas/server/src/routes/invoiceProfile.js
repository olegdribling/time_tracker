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
      chargeGst: row.charge_gst,
      myEmail: row.my_email,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

router.put('/', async (req, res) => {
  const { fullName, address, abn, speciality, accountBankName, bsb, accountNumber, nextInvoiceNumber, chargeGst, myEmail } = req.body
  try {
    await pool.query(
      `INSERT INTO invoice_profiles
         (user_id, full_name, address, abn, speciality, account_bank_name, bsb, account_number, next_invoice_number, charge_gst, my_email)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (user_id) DO UPDATE SET
         full_name=EXCLUDED.full_name, address=EXCLUDED.address, abn=EXCLUDED.abn,
         speciality=EXCLUDED.speciality, account_bank_name=EXCLUDED.account_bank_name,
         bsb=EXCLUDED.bsb, account_number=EXCLUDED.account_number,
         next_invoice_number=EXCLUDED.next_invoice_number, charge_gst=EXCLUDED.charge_gst,
         my_email=EXCLUDED.my_email, updated_at=NOW()`,
      [req.userId, fullName || '', address || '', abn || '', speciality || '',
       accountBankName || '', bsb || '', accountNumber || '', nextInvoiceNumber ?? 1, chargeGst ?? false, myEmail || '']
    )
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router

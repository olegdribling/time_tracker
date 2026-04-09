import type { InvoiceProfile, Settings } from '../types'

export const INITIAL_HOURLY_RATE = 25

export const DEFAULT_SETTINGS: Settings = {
  period: 'weekly',
  weekStart: 'monday',
}

export const DEFAULT_INVOICE_PROFILE: InvoiceProfile = {
  fullName: '',
  address: '',
  abn: '',
  speciality: '',
  accountBankName: '',
  bsb: '',
  accountNumber: '',
  nextInvoiceNumber: 1,
  gstMode: 'none',
  hourlyRate: INITIAL_HOURLY_RATE,
  weekendRateEnabled: false,
  weekendRate: INITIAL_HOURLY_RATE,
}

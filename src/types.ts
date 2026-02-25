export type Shift = {
  id: string
  date: string // YYYY-MM-DD
  start: string // HH:MM
  end: string // HH:MM
  lunchMinutes: number
  comment?: string
  hourlyRate: number
  clientId?: number | null
}

export type ShiftForm = {
  date: string
  start: string
  end: string
  lunchMinutes: number
  comment: string
  clientId: number | null
}

export type Settings = {
  period: 'weekly' | 'monthly' | 'custom'
  weekStart: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
  hourlyRate: number
  weekendRateEnabled: boolean
  weekendRate: number
}

export type Client = {
  id: number
  name: string
  address: string
  abn: string
  email: string
}

export type ClientDraft = Omit<Client, 'id'>

export type InvoiceProfile = {
  fullName: string
  address: string
  abn: string
  speciality: string
  accountBankName: string
  bsb: string
  accountNumber: string
  nextInvoiceNumber: number
  chargeGst: boolean
}

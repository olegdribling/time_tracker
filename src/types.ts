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
}

export type Client = {
  id: number
  name: string
  address: string
  abn: string
  email: string
}

export type ClientDraft = Omit<Client, 'id'>

export type Product = {
  id: number
  name: string
  price: number
}

export type ProductDraft = Omit<Product, 'id'>

export type InvoiceLineItem =
  | { id: number; type: 'time'; description: string; durationHours: string; durationMinutes: string; rate: string; exactAmount?: number }
  | { id: number; type: 'service'; description: string; amount: string }
  | { id: number; type: 'product'; description: string; quantity: string; unitPrice: string }

export type ArchivedInvoice = {
  id: string
  invoice_number: string
  client_id: number | null
  client_snapshot: { name: string; address?: string; abn?: string }
  line_items: InvoiceLineItem[]
  subtotal: number
  gst: number
  total: number
  gst_mode: 'none' | 'exclusive' | 'inclusive'
  status: 'sent' | 'paid' | 'cancelled'
  issued_date: string
  comments?: string | null
  period_start?: string | null
  period_end?: string | null
  profile_snapshot: InvoiceProfile
  created_at: string
}

export type ExpenseCategory =
  | 'Vehicle & travel'
  | 'Home office'
  | 'Equipment'
  | 'Software & subscriptions'
  | 'Marketing'
  | 'Professional services'
  | 'Training & education'
  | 'Insurance'
  | 'Bank fees'
  | 'Subcontractors'

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Vehicle & travel', 'Home office', 'Equipment', 'Software & subscriptions',
  'Marketing', 'Professional services', 'Training & education',
  'Insurance', 'Bank fees', 'Subcontractors',
]

export type Expense = {
  id: number
  vendor: string
  amount: number
  gst: number
  category: ExpenseCategory
  expense_date: string
  description?: string | null
  created_at: string
}

export type ExpenseDraft = {
  vendor: string
  amount: number
  gst: number
  category: ExpenseCategory
  expense_date: string
  description?: string
}

export type InvoiceProfile = {
  fullName: string
  address: string
  abn: string
  speciality: string
  accountBankName: string
  bsb: string
  accountNumber: string
  nextInvoiceNumber: number
  gstMode: 'none' | 'exclusive' | 'inclusive'
  hourlyRate: number
  weekendRateEnabled: boolean
  weekendRate: number
}

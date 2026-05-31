import type { ArchivedInvoice, Client, ClientDraft, Expense, ExpenseDraft, InvoiceProfile, Product, ProductDraft, Settings, Shift } from './types'

const API_URL = import.meta.env.VITE_API_URL || ''

const getToken = () => localStorage.getItem('tt_token') || ''
const getRefreshToken = () => localStorage.getItem('tt_refresh_token') || ''

const setTokens = (token: string, refreshToken: string) => {
  localStorage.setItem('tt_token', token)
  localStorage.setItem('tt_refresh_token', refreshToken)
}

const clearTokens = () => {
  localStorage.removeItem('tt_token')
  localStorage.removeItem('tt_refresh_token')
  localStorage.removeItem('tt_auth')
}

let refreshPromise: Promise<string | null> | null = null

async function doRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    clearTokens()
    window.location.href = '/login'
    return null
  }
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!res.ok) {
      clearTokens()
      window.location.href = '/login'
      return null
    }
    const data = await res.json()
    setTokens(data.token, data.refreshToken)
    return data.token
  } catch {
    clearTokens()
    window.location.href = '/login'
    return null
  }
}

async function fetchAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const makeHeaders = (token: string): HeadersInit => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  })

  const res = await fetch(url, { ...options, headers: makeHeaders(getToken()) })
  if (res.status !== 401) return res

  // Deduplicate concurrent refresh calls
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => { refreshPromise = null })
  }
  const newToken = await refreshPromise
  if (!newToken) return res

  return fetch(url, { ...options, headers: makeHeaders(newToken) })
}

function compressImage(file: File, maxPx: number, quality: number): Promise<File> {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(blob => {
        resolve(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file)
      }, 'image/jpeg', quality)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

export const api = {
  // Auth
  async register(email: string, password: string) {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    return res.json()
  },

  async login(email: string, password: string) {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    return res.json()
  },

  async forgotPassword(email: string) {
    const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    return res.json()
  },

  async resetPassword(token: string, password: string) {
    const res = await fetch(`${API_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
    return res.json()
  },

  async me() {
    const res = await fetchAuth(`${API_URL}/api/auth/me`)
    return res.json()
  },

  async logout() {
    const refreshToken = getRefreshToken()
    clearTokens()
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {})
  },

  // Shifts
  async getShifts(): Promise<Shift[]> {
    const res = await fetchAuth(`${API_URL}/api/shifts`)
    return res.json()
  },

  async createShift(shift: Shift) {
    const res = await fetchAuth(`${API_URL}/api/shifts`, {
      method: 'POST',
      body: JSON.stringify(shift),
    })
    if (!res.ok) throw new Error(`Failed to create shift: ${res.status}`)
  },

  async updateShift(shift: Shift) {
    const res = await fetchAuth(`${API_URL}/api/shifts/${shift.id}`, {
      method: 'PUT',
      body: JSON.stringify(shift),
    })
    if (!res.ok) throw new Error(`Failed to update shift: ${res.status}`)
  },

  async deleteShift(id: string) {
    const res = await fetchAuth(`${API_URL}/api/shifts/${id}`, {
      method: 'DELETE',
    })
    if (!res.ok) throw new Error(`Failed to delete shift: ${res.status}`)
  },

  // Settings
  async getSettings(): Promise<Settings | null> {
    const res = await fetchAuth(`${API_URL}/api/settings`)
    return res.json()
  },

  async saveSettings(settings: Settings) {
    const res = await fetchAuth(`${API_URL}/api/settings`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    })
    if (!res.ok) throw new Error(`Failed to save settings: ${res.status}`)
  },

  // Invoice Profile
  async getInvoiceProfile(): Promise<InvoiceProfile | null> {
    const res = await fetchAuth(`${API_URL}/api/invoice-profile`)
    return res.json()
  },

  async saveInvoiceProfile(profile: InvoiceProfile) {
    const res = await fetchAuth(`${API_URL}/api/invoice-profile`, {
      method: 'PUT',
      body: JSON.stringify(profile),
    })
    if (!res.ok) throw new Error(`Failed to save invoice profile: ${res.status}`)
  },

  // Clients
  async getClients(): Promise<Client[]> {
    const res = await fetchAuth(`${API_URL}/api/clients`)
    return res.json()
  },

  async createClient(draft: ClientDraft): Promise<{ id: number }> {
    const res = await fetchAuth(`${API_URL}/api/clients`, {
      method: 'POST',
      body: JSON.stringify(draft),
    })
    if (!res.ok) throw new Error(`Failed to create client: ${res.status}`)
    return res.json()
  },

  async updateClient(id: number, draft: ClientDraft): Promise<void> {
    const res = await fetchAuth(`${API_URL}/api/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(draft),
    })
    if (!res.ok) throw new Error(`Failed to update client: ${res.status}`)
  },

  async deleteClient(id: number): Promise<void> {
    const res = await fetchAuth(`${API_URL}/api/clients/${id}`, {
      method: 'DELETE',
    })
    if (!res.ok) throw new Error(`Failed to delete client: ${res.status}`)
  },

  // Products
  async getProducts(): Promise<Product[]> {
    const res = await fetchAuth(`${API_URL}/api/products`)
    return res.json()
  },

  async createProduct(draft: ProductDraft): Promise<{ id: number }> {
    const res = await fetchAuth(`${API_URL}/api/products`, {
      method: 'POST',
      body: JSON.stringify(draft),
    })
    if (!res.ok) throw new Error(`Failed to create product: ${res.status}`)
    return res.json()
  },

  async updateProduct(id: number, draft: ProductDraft): Promise<void> {
    const res = await fetchAuth(`${API_URL}/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(draft),
    })
    if (!res.ok) throw new Error(`Failed to update product: ${res.status}`)
  },

  async deleteProduct(id: number): Promise<void> {
    const res = await fetchAuth(`${API_URL}/api/products/${id}`, {
      method: 'DELETE',
    })
    if (!res.ok) throw new Error(`Failed to delete product: ${res.status}`)
  },

  // Invoices archive
  async getInvoices(): Promise<ArchivedInvoice[]> {
    const res = await fetchAuth(`${API_URL}/api/invoices`)
    if (!res.ok) throw new Error('Failed to load invoices')
    return res.json()
  },

  async createInvoiceRecord(data: Omit<ArchivedInvoice, 'id' | 'status' | 'created_at'>): Promise<{ id: string }> {
    const res = await fetchAuth(`${API_URL}/api/invoices`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to save invoice')
    return res.json()
  },

  async updateInvoiceStatus(id: string, status: ArchivedInvoice['status']): Promise<void> {
    const res = await fetchAuth(`${API_URL}/api/invoices/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
    if (!res.ok) throw new Error('Failed to update status')
  },

  async deleteInvoice(id: string): Promise<void> {
    const res = await fetchAuth(`${API_URL}/api/invoices/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete invoice')
  },

  // Billing
  async getBillingStatus(): Promise<{ plan: string; trial_ends_at: string | null; current_period_end: string | null; active: boolean }> {
    const res = await fetchAuth(`${API_URL}/api/billing/status`)
    return res.json()
  },

  async createCheckout(plan: 'solo' | 'pro'): Promise<{ url?: string; error?: string }> {
    const res = await fetchAuth(`${API_URL}/api/billing/checkout`, {
      method: 'POST',
      body: JSON.stringify({ plan }),
    })
    return res.json()
  },

  async createPortal(): Promise<{ url?: string; error?: string }> {
    const res = await fetchAuth(`${API_URL}/api/billing/portal`, {
      method: 'POST',
    })
    return res.json()
  },

  // Expenses
  async getExpenses(): Promise<Expense[]> {
    const res = await fetchAuth(`${API_URL}/api/expenses`)
    if (!res.ok) throw new Error('Failed to load expenses')
    return res.json()
  },

  async scanReceipt(file: File): Promise<Partial<ExpenseDraft>> {
    // Compress image to max 1800px and <2MB before uploading
    const compressed = file.type === 'application/pdf' ? file : await compressImage(file, 1800, 0.85)
    const formData = new FormData()
    formData.append('receipt', compressed)
    const token = localStorage.getItem('tt_token') || ''
    const res = await fetch(`${API_URL}/api/expenses/scan`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    if (res.status === 422) throw new Error('not_a_receipt')
    if (!res.ok) throw new Error('Failed to scan receipt')
    return res.json()
  },

  async createExpense(draft: ExpenseDraft): Promise<{ id: number }> {
    const res = await fetchAuth(`${API_URL}/api/expenses`, {
      method: 'POST',
      body: JSON.stringify(draft),
    })
    if (!res.ok) throw new Error('Failed to save expense')
    return res.json()
  },

  async updateExpense(id: number, draft: ExpenseDraft): Promise<void> {
    const res = await fetchAuth(`${API_URL}/api/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(draft),
    })
    if (!res.ok) throw new Error('Failed to update expense')
  },

  async deleteExpense(id: number): Promise<void> {
    const res = await fetchAuth(`${API_URL}/api/expenses/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete expense')
  },
}

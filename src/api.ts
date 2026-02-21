import type { InvoiceProfile, Settings, Shift } from './types'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const getToken = () => localStorage.getItem('tt_token') || ''

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getToken()}`,
})

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

  async me() {
    const res = await fetch(`${API_URL}/api/auth/me`, { headers: authHeaders() })
    return res.json()
  },

  // Shifts
  async getShifts(): Promise<Shift[]> {
    const res = await fetch(`${API_URL}/api/shifts`, { headers: authHeaders() })
    return res.json()
  },

  async createShift(shift: Shift) {
    await fetch(`${API_URL}/api/shifts`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(shift),
    })
  },

  async updateShift(shift: Shift) {
    await fetch(`${API_URL}/api/shifts/${shift.id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(shift),
    })
  },

  async deleteShift(id: string) {
    await fetch(`${API_URL}/api/shifts/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
  },

  // Settings
  async getSettings(): Promise<Settings | null> {
    const res = await fetch(`${API_URL}/api/settings`, { headers: authHeaders() })
    return res.json()
  },

  async saveSettings(settings: Settings) {
    await fetch(`${API_URL}/api/settings`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(settings),
    })
  },

  // Invoice Profile
  async getInvoiceProfile(): Promise<InvoiceProfile | null> {
    const res = await fetch(`${API_URL}/api/invoice-profile`, { headers: authHeaders() })
    return res.json()
  },

  async saveInvoiceProfile(profile: InvoiceProfile) {
    await fetch(`${API_URL}/api/invoice-profile`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(profile),
    })
  },

  // Billing
  async getBillingStatus(): Promise<{ plan: string; trial_ends_at: string | null; current_period_end: string | null; active: boolean }> {
    const res = await fetch(`${API_URL}/api/billing/status`, { headers: authHeaders() })
    return res.json()
  },

  async createCheckout(plan: 'solo' | 'pro'): Promise<{ url?: string; error?: string }> {
    const res = await fetch(`${API_URL}/api/billing/checkout`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ plan }),
    })
    return res.json()
  },

  async createPortal(): Promise<{ url?: string; error?: string }> {
    const res = await fetch(`${API_URL}/api/billing/portal`, {
      method: 'POST',
      headers: authHeaders(),
    })
    return res.json()
  },
}

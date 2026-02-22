import type { Client, ClientDraft, InvoiceProfile, Settings, Shift } from './types'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

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

  let res = await fetch(url, { ...options, headers: makeHeaders(getToken()) })
  if (res.status !== 401) return res

  // Deduplicate concurrent refresh calls
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => { refreshPromise = null })
  }
  const newToken = await refreshPromise
  if (!newToken) return res

  return fetch(url, { ...options, headers: makeHeaders(newToken) })
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
    await fetchAuth(`${API_URL}/api/shifts`, {
      method: 'POST',
      body: JSON.stringify(shift),
    })
  },

  async updateShift(shift: Shift) {
    await fetchAuth(`${API_URL}/api/shifts/${shift.id}`, {
      method: 'PUT',
      body: JSON.stringify(shift),
    })
  },

  async deleteShift(id: string) {
    await fetchAuth(`${API_URL}/api/shifts/${id}`, {
      method: 'DELETE',
    })
  },

  // Settings
  async getSettings(): Promise<Settings | null> {
    const res = await fetchAuth(`${API_URL}/api/settings`)
    return res.json()
  },

  async saveSettings(settings: Settings) {
    await fetchAuth(`${API_URL}/api/settings`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    })
  },

  // Invoice Profile
  async getInvoiceProfile(): Promise<InvoiceProfile | null> {
    const res = await fetchAuth(`${API_URL}/api/invoice-profile`)
    return res.json()
  },

  async saveInvoiceProfile(profile: InvoiceProfile) {
    await fetchAuth(`${API_URL}/api/invoice-profile`, {
      method: 'PUT',
      body: JSON.stringify(profile),
    })
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
    return res.json()
  },

  async updateClient(id: number, draft: ClientDraft): Promise<void> {
    await fetchAuth(`${API_URL}/api/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(draft),
    })
  },

  async deleteClient(id: number): Promise<void> {
    await fetchAuth(`${API_URL}/api/clients/${id}`, {
      method: 'DELETE',
    })
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
}

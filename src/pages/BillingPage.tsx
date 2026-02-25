import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

interface BillingStatus {
  plan: string
  trial_ends_at: string | null
  current_period_end: string | null
  active: boolean
}

const PLANS = [
  {
    id: 'solo' as const,
    name: 'Solo',
    price: '$5 AUD',
    period: 'month',
    features: ['1 client / contractor', 'Unlimited shifts', 'Invoice generation', 'PDF export'],
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    price: '$10 AUD',
    period: 'month',
    features: ['Unlimited clients', 'Unlimited shifts', 'Invoice generation', 'PDF export', 'Priority support'],
  },
]

function daysLeft(dateStr: string | null): number {
  if (!dateStr) return 0
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function BillingPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('success')) {
      // небольшая задержка чтоб webhook успел обработаться
      setTimeout(() => api.getBillingStatus().then(setStatus).finally(() => setLoading(false)), 2000)
    } else {
      api.getBillingStatus().then(setStatus).finally(() => setLoading(false))
    }
  }, [])

  const handleCheckout = async (plan: 'solo' | 'pro') => {
    setCheckoutLoading(plan)
    const data = await api.createCheckout(plan)
    if (data.url) {
      window.location.href = data.url
    } else {
      alert(data.error || 'Something went wrong')
      setCheckoutLoading(null)
    }
  }

  const handlePortal = async () => {
    setPortalLoading(true)
    const data = await api.createPortal()
    if (data.url) {
      window.location.href = data.url
    } else {
      alert(data.error || 'Something went wrong')
      setPortalLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="billing-shell">
        <div className="billing-loading">Loading billing info…</div>
      </div>
    )
  }

  const plan = status?.plan ?? 'trial'
  const isPaid = plan === 'solo' || plan === 'pro'
  const isTrial = plan === 'trial'
  const isCancelled = plan === 'cancelled'

  return (
    <div className="billing-shell">
      <header className="billing-topbar">
        <button className="billing-back-btn" onClick={() => navigate('/app')}>
          ← Back
        </button>
      </header>
    <div className="billing-page">
      <div className="billing-header">
        <h2 className="billing-title">Subscription</h2>

        <div className="billing-status-card">
          {isTrial && (
            <>
              <span className="billing-badge billing-badge--trial">Free trial</span>
              <p className="billing-status-text">
                {status?.active
                  ? <>{daysLeft(status.trial_ends_at)} days left — trial ends {formatDate(status.trial_ends_at)}</>
                  : <>Your trial has expired. Choose a plan to continue.</>
                }
              </p>
            </>
          )}
          {isPaid && (
            <>
              <span className={`billing-badge billing-badge--${plan}`}>{plan === 'solo' ? 'Solo' : 'Pro'}</span>
              <p className="billing-status-text">
                Active until {formatDate(status?.current_period_end ?? null)}
              </p>
              <button
                className="billing-portal-btn"
                onClick={handlePortal}
                disabled={portalLoading}
              >
                {portalLoading ? 'Opening…' : 'Manage subscription'}
              </button>
            </>
          )}
          {isCancelled && (
            <>
              <span className="billing-badge billing-badge--cancelled">Cancelled</span>
              <p className="billing-status-text">Your subscription has been cancelled. Choose a plan below to resubscribe.</p>
            </>
          )}
        </div>
      </div>

      <div className="billing-plans">
        {PLANS.map(p => {
          const isActive = plan === p.id
          return (
            <div key={p.id} className={`billing-plan-card ${isActive ? 'billing-plan-card--active' : ''}`}>
              {isActive && <div className="billing-plan-current-label">Current plan</div>}
              <div className="billing-plan-name">{p.name}</div>
              <div className="billing-plan-price">
                <span className="billing-plan-amount">{p.price}</span>
                <span className="billing-plan-period"> / {p.period}</span>
              </div>
              <ul className="billing-plan-features">
                {p.features.map(f => (
                  <li key={f} className="billing-plan-feature">
                    <span className="billing-plan-check">✓</span> {f}
                  </li>
                ))}
              </ul>
              <button
                className={`billing-plan-btn ${isActive ? 'billing-plan-btn--active' : 'billing-plan-btn--upgrade'}`}
                onClick={() => {
                  if (isActive) return
                  if (isPaid) handlePortal()
                  else handleCheckout(p.id)
                }}
                disabled={isActive || checkoutLoading !== null || portalLoading}
              >
                {checkoutLoading === p.id || (portalLoading && !isActive && isPaid)
                  ? 'Redirecting…'
                  : isActive
                    ? 'Current plan'
                    : isPaid
                      ? 'Switch plan'
                      : 'Subscribe'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
    </div>
  )
}

import { useState } from 'react'
import { X, Receipt, Sparkles, LayoutGrid, FileCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const KEY = 'tt_whats_new_v2'

function Feature({ icon: Icon, color, title, description }: {
  icon: LucideIcon
  color: string
  title: string
  description: string
}) {
  return (
    <div className="whats-new-feature">
      <div className="whats-new-feature__icon" style={{ background: color }}>
        <Icon size={20} strokeWidth={1.8} />
      </div>
      <div>
        <div className="whats-new-feature__title">{title}</div>
        <div className="whats-new-feature__desc">{description}</div>
      </div>
    </div>
  )
}

export function WhatsNewModal() {
  const [open, setOpen] = useState(() => !localStorage.getItem(KEY))

  if (!open) return null

  const close = () => {
    localStorage.setItem(KEY, '1')
    setOpen(false)
  }

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header-dark">
          <span className="modal-title-dark">What's New</span>
          <button className="modal-close-btn" onClick={close}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ gap: 16 }}>
          <Feature
            icon={FileCheck}
            color="#f0eef8"
            title="Invoice History"
            description="Invoices are now saved automatically. Track their status — mark as Paid or Cancelled, and reopen any invoice as a PDF."
          />
          <Feature
            icon={Receipt}
            color="#e8f8ee"
            title="Expense Tracking"
            description="Track your business expenses — categorise them and keep everything in one place."
          />
          <Feature
            icon={Sparkles}
            color="#fff8e6"
            title="AI Receipt Scanning"
            description="Take a photo of a receipt and AI fills in the vendor, amount and GST automatically."
          />
          <Feature
            icon={LayoutGrid}
            color="#eef0f6"
            title="New Navigation"
            description="Faster access to Time Tracking, Invoices and Expenses via the bottom bar."
          />
        </div>
        <div className="modal-footer">
          <button className="primary-btn" style={{ width: '100%' }} onClick={close}>
            Got it!
          </button>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Download } from 'lucide-react'
import { api } from '../api'
import { generateInvoicePdf } from '../lib/invoice'
import { money } from '../lib/format'
import type { ArchivedInvoice, InvoiceLineItem } from '../types'
import { calcLineItemAmount } from './CreateInvoiceModal'

function StyledSelect({ value, options, onChange }: {
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find(o => o.value === value)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <button type="button" className="inv-archive-select" onClick={() => setOpen(p => !p)}>
        {selected?.label ?? ''}
      </button>
      {open && (
        <div className="inv-archive-dropdown">
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              className={o.value === value ? 'active' : ''}
              onMouseDown={() => { onChange(o.value); setOpen(false) }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const STATUS_LABELS: Record<ArchivedInvoice['status'], string> = {
  sent: 'Sent',
  paid: 'Paid',
  cancelled: 'Cancelled',
}

const PERIOD_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: 'year', label: 'This year' },
  { value: 'month', label: 'This month' },
  { value: 'week', label: 'This week' },
  { value: 'today', label: 'Today' },
]

function isInPeriod(issuedDate: string, period: string): boolean {
  if (period === 'all') return true
  const d = new Date(`${issuedDate}T00:00:00`)
  const now = new Date()
  if (period === 'today') {
    return d.toDateString() === now.toDateString()
  }
  if (period === 'week') {
    const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7)
    return d >= weekAgo
  }
  if (period === 'month') {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }
  if (period === 'year') {
    return d.getFullYear() === now.getFullYear()
  }
  return true
}

function buildPdfItems(lineItems: InvoiceLineItem[]) {
  return lineItems.map(item => {
    const amount = calcLineItemAmount(item)
    if (item.type === 'time') {
      const h = parseInt(item.durationHours) || 0
      const m = parseInt(item.durationMinutes) || 0
      const qty = m > 0 ? `${h}h${m}m` : `${h}h`
      return { description: item.description, unitPrice: parseFloat(item.rate) || 0, qty, amount }
    }
    if (item.type === 'product') {
      return { description: item.description, unitPrice: parseFloat(item.unitPrice) || 0, qty: item.quantity, amount }
    }
    return { description: item.description, amount }
  })
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(`${iso}T00:00:00`))
}

interface Props {
  invoices: ArchivedInvoice[]
  onStatusChange: (id: string, status: ArchivedInvoice['status']) => void
  onDelete: (id: string) => void
}

export function InvoicesView({ invoices, onStatusChange, onDelete }: Props) {
  const [filterClient, setFilterClient] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPeriod, setFilterPeriod] = useState('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [statusMenuId, setStatusMenuId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])
  const [downloading, setDownloading] = useState<string | null>(null)

  const clientOptions = useMemo(() => {
    const seen = new Map<string, string>()
    invoices.forEach(inv => {
      const key = String(inv.client_id ?? inv.client_snapshot.name)
      if (!seen.has(key)) seen.set(key, inv.client_snapshot.name)
    })
    return Array.from(seen.entries()).map(([value, label]) => ({ value, label }))
  }, [invoices])

  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      if (filterStatus !== 'all' && inv.status !== filterStatus) return false
      if (filterClient !== 'all') {
        const key = String(inv.client_id ?? inv.client_snapshot.name)
        if (key !== filterClient) return false
      }
      if (!isInPeriod(inv.issued_date, filterPeriod)) return false
      return true
    })
  }, [invoices, filterClient, filterStatus, filterPeriod])

  const summary = useMemo(() => {
    const total = filtered.filter(inv => inv.status !== 'cancelled').reduce((s, inv) => s + Number(inv.total), 0)
    const gst = filtered.filter(inv => inv.status !== 'cancelled').reduce((s, inv) => s + Number(inv.gst), 0)
    const paid = filtered.filter(inv => inv.status === 'paid').reduce((s, inv) => s + Number(inv.total), 0)
    const unpaid = filtered.filter(inv => inv.status === 'sent').reduce((s, inv) => s + Number(inv.total), 0)
    return { total, gst, paid, unpaid }
  }, [filtered])

  const handleDownload = async (inv: ArchivedInvoice) => {
    setDownloading(inv.id)
    try {
      const items = buildPdfItems(inv.line_items)
      const period = {
        start: inv.period_start ?? inv.issued_date,
        end: inv.period_end ?? inv.issued_date,
      }
      await generateInvoicePdf({
        profile: inv.profile_snapshot,
        period,
        invoiceNumber: parseInt(inv.invoice_number) || 1,
        itemLabel: '',
        unitPrice: 0,
        quantityMinutes: 0,
        subtotal: Number(inv.subtotal),
        gst: Number(inv.gst),
        balanceDue: Number(inv.total),
        billTo: {
          name: inv.client_snapshot.name,
          address: inv.client_snapshot.address ?? '',
          abn: inv.client_snapshot.abn ?? '',
        },
        items,
        comments: inv.comments ?? undefined,
        gstMode: inv.gst_mode,
      })
    } finally {
      setDownloading(null)
    }
  }

  const handleStatusChange = async (inv: ArchivedInvoice, status: ArchivedInvoice['status']) => {
    setStatusMenuId(null)
    try {
      await api.updateInvoiceStatus(inv.id, status)
      onStatusChange(inv.id, status)
    } catch {
      alert('Failed to update status')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.deleteInvoice(id)
      onDelete(id)
    } catch {
      alert('Failed to delete invoice')
    } finally {
      setDeleteConfirmId(null)
    }
  }

  return (
    <section className="clients-section inv-view" onClick={() => setStatusMenuId(null)}>
      <div className="inv-fixed-top">
      {/* Filters */}
      <div className="inv-archive-filters" onClick={e => e.stopPropagation()}>
        <StyledSelect
          value={filterClient}
          options={[{ value: 'all', label: 'All clients' }, ...clientOptions]}
          onChange={setFilterClient}
        />
        <StyledSelect
          value={filterStatus}
          options={[
            { value: 'all', label: 'All' },
            { value: 'sent', label: 'Sent' },
            { value: 'paid', label: 'Paid' },
          ]}
          onChange={setFilterStatus}
        />
        <StyledSelect
          value={filterPeriod}
          options={PERIOD_OPTIONS}
          onChange={setFilterPeriod}
        />
      </div>
      </div>{/* end inv-fixed-top */}

      <div className="inv-scroll-body">
      {/* Summary card */}
      <div className="overview inv-summary-overview">
        <div className="inv-summary-overview-layout">
          <div className="overview-label">All Invoices</div>
          <div className="inv-summary-overview-right">
            <div className="overview-value">${money(summary.total)}</div>
            {summary.gst > 0 && (
              <div className="overview-sub">GST ${money(summary.gst)}</div>
            )}
          </div>
        </div>
        <div className="inv-summary-overview-rows">
          <div className="inv-summary-overview-row">
            <span className="inv-summary-dot paid" />
            <span>Paid</span>
            <span className="inv-summary-amount paid">${money(summary.paid)}</span>
          </div>
          <div className="inv-summary-overview-row">
            <span className="inv-summary-dot unpaid" />
            <span>Unpaid</span>
            <span className="inv-summary-amount">${money(summary.unpaid)}</span>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="report-row empty">
          {invoices.length === 0 ? 'No invoices yet. Create your first invoice.' : 'No invoices match the filters.'}
        </div>
      ) : (
        filtered.map(inv => (
          <div key={inv.id} className={`inv-archive-card${expandedId === inv.id ? ' is-expanded' : ''}`}>
            {/* Row */}
            <div
              className="inv-archive-row"
              onClick={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
            >
              <div className="inv-archive-left">
                <div className="inv-archive-num">INV-{inv.invoice_number.padStart(3, '0')}</div>
                <div className="inv-archive-client">{inv.client_snapshot.name}</div>
              </div>
              <div className="inv-archive-right">
                <div className="inv-archive-amount">${money(Number(inv.total))}</div>
                <div className="inv-archive-date">{formatDate(inv.issued_date)}</div>
              </div>
              <div className="inv-archive-status-wrap" onClick={e => e.stopPropagation()}>
                <button
                  className={`inv-archive-status inv-archive-status--${inv.status}`}
                  onClick={() => setStatusMenuId(statusMenuId === inv.id ? null : inv.id)}
                >
                  {STATUS_LABELS[inv.status]}
                  <ChevronDown size={12} />
                </button>
                {statusMenuId === inv.id && (
                  <div className="inv-archive-status-menu">
                    {(['sent', 'paid', 'cancelled'] as const).filter(s => s !== inv.status).map(s => (
                      <button
                        key={s}
                        className="inv-archive-status-option"
                        onClick={() => handleStatusChange(inv, s)}
                      >
                        {STATUS_LABELS[s]}
                      </button>
                    ))}
                    <div className="inv-archive-status-divider" />
                    <button
                      className="inv-archive-status-option inv-archive-status-option--delete"
                      onClick={() => { setStatusMenuId(null); setDeleteConfirmId(inv.id) }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Expanded detail */}
            {expandedId === inv.id && (
              <div className="inv-archive-detail">
                <div className="inv-archive-items">
                  {inv.line_items.map((item, i) => (
                    <div key={i} className="inv-archive-item-row">
                      <span className="inv-archive-item-desc">{item.description}</span>
                      <span className="inv-archive-item-amount">${money(calcLineItemAmount(item))}</span>
                    </div>
                  ))}
                  {Number(inv.gst) > 0 && (
                    <div className="inv-archive-item-row inv-archive-item-gst">
                      <span>GST</span>
                      <span>${money(Number(inv.gst))}</span>
                    </div>
                  )}
                  <div className="inv-archive-item-row inv-archive-item-total">
                    <span>Total</span>
                    <span>${money(Number(inv.total))}</span>
                  </div>
                </div>
                {inv.comments && (
                  <div className="inv-archive-comments">{inv.comments}</div>
                )}
                <button
                  className="inv-archive-download-btn"
                  onClick={() => handleDownload(inv)}
                  disabled={downloading === inv.id}
                >
                  <Download size={15} />
                  {downloading === inv.id ? 'Generating…' : 'Download PDF'}
                </button>
              </div>
            )}
          </div>
        ))
      )}
      </div>{/* end inv-scroll-body */}

      {deleteConfirmId && (
        <div className="modal-backdrop" onClick={() => setDeleteConfirmId(null)}>
          <div className="modal" style={{ maxWidth: 340 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '24px 20px 8px' }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 16, marginBottom: 8 }}>Delete invoice?</p>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary, #666)' }}>
                Do you want to permanently delete this document?
              </p>
            </div>
            <div className="inv-footer">
              <button className="ghost-button" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
              <button
                className="ghost-button"
                style={{ color: '#ff3b30', fontWeight: 600 }}
                onClick={() => handleDelete(deleteConfirmId)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

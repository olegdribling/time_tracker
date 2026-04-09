import { ChevronLeft, ChevronRight, FileText, X } from 'lucide-react'
import type { Client, InvoiceLineItem, InvoiceProfile } from '../types'
import { formatDate, money } from '../lib/format'


export function calcLineItemAmount(item: InvoiceLineItem): number {
  if (item.type === 'time') {
    if (item.exactAmount !== undefined) return item.exactAmount
    return ((parseInt(item.durationHours) || 0) * 60 + (parseInt(item.durationMinutes) || 0)) / 60 * (parseFloat(item.rate) || 0)
  }
  if (item.type === 'service') return parseFloat(item.amount) || 0
  return (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)
}

function InvoiceLineItemCard({ item, idx, onChange, onRemove }: {
  item: InvoiceLineItem
  idx: number
  onChange: (updated: InvoiceLineItem) => void
  onRemove: () => void
}) {
  return (
    <div className="inv-line-item-card">
      <div className="inv-item-title-row">
        <div className="inv-item-title">Item {idx + 1} <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{item.type}</span></div>
        <button type="button" className="inv-remove-item-btn" onClick={onRemove}><X size={14} /></button>
      </div>
      <div className="field">
        <span className="label">Description</span>
        <input type="text" value={item.description} onChange={e => onChange({ ...item, description: e.target.value })} />
      </div>
      {item.type === 'time' && (
        <>
          <div className="double">
            <div className="field">
              <span className="label">Duration</span>
              <div className="duration-input">
                <input type="text" inputMode="numeric" value={item.durationHours} onChange={e => { const v = e.target.value.replace(/\D/g, ''); onChange({ ...item, durationHours: v, exactAmount: undefined }) }} />
                <span className="duration-sep">h</span>
                <input type="text" inputMode="numeric" value={item.durationMinutes} onChange={e => { const v = e.target.value.replace(/\D/g, ''); onChange({ ...item, durationMinutes: v, exactAmount: undefined }) }} />
                <span className="duration-sep">m</span>
              </div>
            </div>
            <div className="field" style={{ alignItems: 'flex-end' }}>
              <span className="label">Rate ($/hr)</span>
              <input type="text" style={{ width: 60 }} value={item.rate} onChange={e => onChange({ ...item, rate: e.target.value, exactAmount: undefined })} onBlur={e => { const v = e.target.value.replace(',', '.'); onChange({ ...item, rate: v, exactAmount: undefined }) }} />
            </div>
          </div>
          <div className="inv-item-amount"><span>Amount</span><strong>${money(calcLineItemAmount(item))}</strong></div>
        </>
      )}
      {item.type === 'service' && (
        <>
          <div className="field">
            <span className="label">Amount ($)</span>
            <input type="number" min="0" step="0.01" value={item.amount} onChange={e => onChange({ ...item, amount: e.target.value })} />
          </div>
          <div className="inv-item-amount"><span>Amount</span><strong>${money(calcLineItemAmount(item))}</strong></div>
        </>
      )}
      {item.type === 'product' && (
        <>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="field" style={{ flex: 1, minWidth: 0 }}>
              <span className="label">Quantity</span>
              <input type="number" min="0" step="1" value={item.quantity} onChange={e => onChange({ ...item, quantity: e.target.value })} />
            </div>
            <div className="field" style={{ flex: 1, minWidth: 0 }}>
              <span className="label">Unit Price</span>
              <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => onChange({ ...item, unitPrice: e.target.value })} />
            </div>
          </div>
          <div className="inv-item-amount"><span>Amount</span><strong>${money(calcLineItemAmount(item))}</strong></div>
        </>
      )}
    </div>
  )
}

export type InvBTForm = {
  number: string
  date: string
  clientId: number | null
  comments: string
}

export type InvSuccessData = {
  clientEmail: string
  invNum: string
  date: string
  invoiceFullName: string
}

type CalendarCell = { date: string | null; day: number | null }

type Props = {
  isOpen: boolean
  form: InvBTForm
  setForm: React.Dispatch<React.SetStateAction<InvBTForm>>
  lineItems: InvoiceLineItem[]
  setLineItems: React.Dispatch<React.SetStateAction<InvoiceLineItem[]>>
  calendarOpen: boolean
  setCalendarOpen: React.Dispatch<React.SetStateAction<boolean>>
  calendarMonth: string
  setCalendarMonth: React.Dispatch<React.SetStateAction<string>>
  calendarCells: CalendarCell[]
  calendarLabel: string
  addMenuOpen: boolean
  setAddMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  clients: Client[]
  invoiceProfile: InvoiceProfile
  todayIso: string
  calendarWeekLabels: string[]
  successData: InvSuccessData | null
  onClose: () => void
  onAddClient: () => void
  onAddItem: (type: InvoiceLineItem['type']) => void
  onGenerate: () => void
  onSuccessClose: () => void
}

export function CreateInvoiceModal({
  isOpen,
  form, setForm,
  lineItems, setLineItems,
  calendarOpen, setCalendarOpen,
  calendarMonth: _calendarMonth, setCalendarMonth,
  calendarCells, calendarLabel,
  addMenuOpen, setAddMenuOpen,
  clients,
  invoiceProfile,
  todayIso,
  calendarWeekLabels,
  successData,
  onClose,
  onAddClient,
  onAddItem,
  onGenerate,
  onSuccessClose,
}: Props) {
  if (!isOpen && !successData) return null

  const subtotal = lineItems.reduce((s, item) => s + calcLineItemAmount(item), 0)
  const { gstMode } = invoiceProfile
  const gst = gstMode === 'exclusive' ? subtotal * 0.1
    : gstMode === 'inclusive' ? subtotal / 11
    : 0
  const total = gstMode === 'inclusive' ? subtotal : subtotal + gst

  return (
    <>
      {isOpen && (
        <div className="modal-backdrop" onClick={onClose}>
          <div className="modal modal--fullscreen" onClick={e => e.stopPropagation()}>
            <div className="inv-header">
              <div className="inv-header-left">
                <FileText size={20} />
                <span className="inv-header-title">Create Invoice</span>
              </div>
              <button className="inv-close-btn" onClick={onClose}><X size={18} /></button>
            </div>

            <div className="form-grid">
              <div>
                <div className="inv-section-title">INVOICE DETAILS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
                  <div className="field">
                    <span className="label">Invoice Number</span>
                    <input
                      type="text"
                      value={`INV-${String(form.number).padStart(3, '0')}`}
                      onChange={e => {
                        const raw = e.target.value.replace(/^INV-0*/, '').replace(/\D/g, '')
                        setForm(prev => ({ ...prev, number: raw || '1' }))
                      }}
                    />
                  </div>
                  <div className="field">
                    <span className="label">Date</span>
                    <button type="button" className="form-field-btn" onClick={() => setCalendarOpen(prev => !prev)}>
                      {formatDate(form.date)}
                    </button>
                    {calendarOpen && (
                      <div className="form-calendar">
                        <div className="form-calendar-header">
                          <button type="button" className="nav-btn" onClick={() => setCalendarMonth(prev => {
                            const [y, m] = prev.split('-').map(Number)
                            const d = new Date(y, m - 2, 1)
                            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                          })}><ChevronLeft size={16} /></button>
                          <span className="form-calendar-title">{calendarLabel}</span>
                          <button type="button" className="nav-btn" onClick={() => setCalendarMonth(prev => {
                            const [y, m] = prev.split('-').map(Number)
                            const d = new Date(y, m, 1)
                            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                          })}><ChevronRight size={16} /></button>
                        </div>
                        <div className="calendar-weekdays">
                          {calendarWeekLabels.map(l => <div key={l} className="calendar-weekday">{l}</div>)}
                        </div>
                        <div className="calendar-grid">
                          {calendarCells.map((cell, idx) => {
                            if (!cell.date || !cell.day) return <div key={`invbt-${idx}`} className="calendar-day-empty" />
                            const isSelected = cell.date === form.date
                            const isToday = cell.date === todayIso
                            return (
                              <button
                                key={cell.date}
                                type="button"
                                className={`calendar-day${isSelected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}`}
                                onClick={() => { setForm(prev => ({ ...prev, date: cell.date! })); setCalendarOpen(false) }}
                              >
                                <span className="calendar-day-number">{cell.day}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="field">
                    <div className="field-label-row">
                      <span className="label">Client</span>
                      <button type="button" className="add-action-btn" onClick={onAddClient}>+ Add Client</button>
                    </div>
                    <select
                      value={form.clientId ?? ''}
                      onChange={e => setForm(prev => ({ ...prev, clientId: e.target.value ? Number(e.target.value) : null }))}
                    >
                      {clients.length === 0 && <option value="" disabled>Add new Client</option>}
                      {clients.length > 1 && <option value="">Select Client</option>}
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ position: 'relative' }}>
                {addMenuOpen && (
                  <div
                    style={{ position: 'absolute', inset: 0, zIndex: 98, backdropFilter: 'blur(2px)', borderRadius: 'inherit' }}
                    onClick={() => setAddMenuOpen(false)}
                  />
                )}
                <div className="inv-section-title-row">
                  <div className="inv-section-title">LINE ITEMS</div>
                  <div style={{ position: 'relative', zIndex: addMenuOpen ? 99 : 'auto' }}>
                    <button type="button" className="add-action-btn" onClick={() => setAddMenuOpen(p => !p)}>+ Add Item</button>
                    {addMenuOpen && (
                      <div className="inv-add-menu">
                        <button onClick={() => onAddItem('time')}>+ Add Time</button>
                        <button onClick={() => onAddItem('service')}>+ Add Service</button>
                        <button onClick={() => onAddItem('product')}>+ Add Product</button>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
                  {lineItems.map((item, idx) => (
                    <InvoiceLineItemCard
                      key={item.id}
                      item={item}
                      idx={idx}
                      onChange={updated => setLineItems(prev => prev.map(i => i.id === item.id ? updated : i))}
                      onRemove={() => setLineItems(prev => prev.filter(i => i.id !== item.id))}
                    />
                  ))}
                </div>
              </div>

              <div className="inv-summary-card">
                <div className="inv-summary-row">
                  <span>Subtotal</span>
                  <span>${money(gstMode === 'inclusive' ? subtotal / 1.1 : subtotal)}</span>
                </div>
                {gstMode !== 'none' && (
                  <div className="inv-summary-row">
                    <span>GST (10%){gstMode === 'inclusive' ? ' incl.' : ''}</span>
                    <span>${money(gst)}</span>
                  </div>
                )}
                <div className="inv-summary-divider" />
                <div className="inv-summary-row inv-summary-total">
                  <strong>Total</strong>
                  <strong>${money(total)}</strong>
                </div>
              </div>

              <div className="field" style={{ marginTop: 14 }}>
                <span className="label">COMMENTS</span>
                <textarea
                  rows={3}
                  style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 14 }}
                  placeholder="Comments will appear on the invoice"
                  value={form.comments}
                  onChange={e => setForm(prev => ({ ...prev, comments: e.target.value }))}
                />
              </div>
            </div>

            <div className="inv-footer">
              <button className="ghost-button" onClick={onClose}>Cancel</button>
              <button className="primary-btn" style={{ flex: 1 }} onClick={onGenerate} disabled={form.clientId === null}>
                Create PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {successData && (
        <div className="modal-backdrop" onClick={onSuccessClose}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div className="inv-header">
              <div className="inv-header-left">
                <FileText size={20} />
                <span className="inv-header-title">Invoice Created</span>
              </div>
              <button className="inv-close-btn" onClick={onSuccessClose}><X size={18} /></button>
            </div>
            <div style={{ padding: '24px 20px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
              <p style={{ margin: '0 0 6px', fontWeight: 600 }}>INV-{successData.invNum} saved as PDF</p>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #666)' }}>
                The file was saved to your Downloads folder.
              </p>
            </div>
            <div className="inv-footer">
              <button className="ghost-button" onClick={onSuccessClose}>Close</button>
              <button
                className="primary-btn"
                style={{ flex: 1 }}
                onClick={() => {
                  const subject = `Invoice #INV-${successData.invNum} – ${successData.invoiceFullName} – ${formatDate(successData.date)}`
                  const mailto = `mailto:${encodeURIComponent(successData.clientEmail)}?subject=${encodeURIComponent(subject)}`
                  window.location.href = mailto
                }}
              >
                Send by Email
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

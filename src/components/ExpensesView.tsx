import { useEffect, useMemo, useRef, useState } from 'react'
import { MoreVertical, Receipt, Car, Home, Laptop, MonitorSmartphone, Megaphone, Briefcase, BookOpen, Shield, CreditCard, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { money } from '../lib/format'
import type { Expense, ExpenseCategory } from '../types'
import { EXPENSE_CATEGORIES } from '../types'
import type { ScanState } from '../hooks/useExpenses'
import type { ExpenseDraft } from '../types'

interface Props {
  expenses: Expense[]
  scanState: ScanState
  scanError: string | null
  setScanError: (e: string | null) => void
  isDuplicate: boolean
  draft: ExpenseDraft
  setDraft: (draft: ExpenseDraft) => void
  editingId: number | null
  isFormOpen: boolean
  handleReceiptFile: (file: File) => void
  openAddExpense: () => void
  openEditExpense: (expense: Expense) => void
  closeForm: () => void
  saveExpense: () => void
  deleteExpense: (id: number) => void
}

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

const CATEGORY_META: Record<ExpenseCategory, { icon: LucideIcon; color: string; bg: string }> = {
  'Vehicle & travel':        { icon: Car,               color: '#2563eb', bg: '#eff6ff' },
  'Home office':             { icon: Home,              color: '#7c3aed', bg: '#f5f3ff' },
  'Equipment':               { icon: Laptop,            color: '#0891b2', bg: '#ecfeff' },
  'Software & subscriptions':{ icon: MonitorSmartphone, color: '#6366f1', bg: '#eef2ff' },
  'Marketing':               { icon: Megaphone,         color: '#ea580c', bg: '#fff7ed' },
  'Professional services':   { icon: Briefcase,         color: '#1a2b42', bg: '#f0f4f8' },
  'Training & education':    { icon: BookOpen,          color: '#059669', bg: '#ecfdf5' },
  'Insurance':               { icon: Shield,            color: '#0284c7', bg: '#f0f9ff' },
  'Bank fees':               { icon: CreditCard,        color: '#b45309', bg: '#fffbeb' },
  'Subcontractors':          { icon: Users,             color: '#db2777', bg: '#fdf2f8' },
}

function formatExpenseDate(value: string) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
    .format(new Date(`${value}T00:00:00`))
}

export function ExpensesView({
  expenses,
  scanState,
  scanError,
  setScanError,
  isDuplicate,
  draft,
  setDraft,
  editingId,
  isFormOpen,
  handleReceiptFile,
  openAddExpense,
  openEditExpense,
  closeForm,
  saveExpense,
  deleteExpense,
}: Props) {
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterVendor, setFilterVendor] = useState('all')

  const categoryOptions = useMemo(() => [
    { value: 'all', label: 'All categories' },
    ...EXPENSE_CATEGORIES
      .filter(c => expenses.some(e => e.category === c))
      .map(c => ({ value: c, label: c })),
  ], [expenses])

  const vendorOptions = useMemo(() => {
    const base = filterCategory === 'all' ? expenses : expenses.filter(e => e.category === filterCategory)
    const vendors = [...new Set(base.map(e => e.vendor).filter(Boolean))]
    return [{ value: 'all', label: 'All vendors' }, ...vendors.map(v => ({ value: v, label: v }))]
  }, [expenses, filterCategory])

  const filteredExpenses = useMemo(() => expenses.filter(e => {
    if (filterCategory !== 'all' && e.category !== filterCategory) return false
    if (filterVendor !== 'all' && e.vendor !== filterVendor) return false
    return true
  }), [expenses, filterCategory, filterVendor])

  const totalAmount = expenses.reduce((s, e) => s + e.amount, 0)
  const totalGst = expenses.reduce((s, e) => s + e.gst, 0)

  const isConfirming = scanState === 'confirming'
  const isScanning = scanState === 'scanning'
  const isSaving = scanState === 'saving'
  const showModal = isFormOpen || isConfirming

  return (
    <div className="expenses-view">
      {/* Scan error banner */}
      {scanError && (
        <div className="expenses-error-banner">
          <span>{scanError}</span>
          <button onClick={() => setScanError(null)}>✕</button>
        </div>
      )}

      {/* Filters */}
      {expenses.length > 0 && (
        <div className="inv-archive-filters" onClick={e => e.stopPropagation()}>
          <StyledSelect value={filterCategory} options={categoryOptions} onChange={v => { setFilterCategory(v); setFilterVendor('all') }} />
          <StyledSelect value={filterVendor} options={vendorOptions} onChange={setFilterVendor} />
        </div>
      )}

      {/* Summary bar */}
      {expenses.length > 0 && (
        <div className="expenses-summary">
          <div className="expenses-summary__card">
            <div className="expenses-summary__main">
              <span className="expenses-summary__label">Total</span>
              <span className="expenses-summary__value">${money(totalAmount)}</span>
            </div>
            {totalGst > 0 && (
              <div className="expenses-summary__side">
                <span className="expenses-summary__label">GST</span>
                <span className="expenses-summary__value expenses-summary__value--gst">${money(totalGst)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Expense list */}
      {expenses.length === 0 ? (
        <div className="expenses-empty">
          <Receipt size={40} strokeWidth={1.2} />
          <p>No expenses yet.</p>
          <p className="expenses-empty__hint">Scan a receipt or add manually.</p>
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="expenses-empty">
          <p>No expenses match the filters.</p>
        </div>
      ) : (
        <ul className="expenses-list" onClick={() => setOpenMenuId(null)}>
          {filteredExpenses.map(expense => (
            <li key={expense.id} className="expense-card">
              <div
                className="expense-card__icon"
                style={{ background: CATEGORY_META[expense.category]?.bg ?? '#f0f0f0' }}
              >
                {(() => { const m = CATEGORY_META[expense.category]; return m ? <m.icon size={18} color={m.color} /> : <Receipt size={18} /> })()}
              </div>
              <div className="expense-card__body">
                <div className="expense-card__top">
                  <span className="expense-card__vendor">{expense.vendor || expense.category}</span>
                  <span className="expense-card__amount">${money(expense.amount)}</span>
                </div>
                <div className="expense-card__bottom">
                  <span
                    className="expense-card__category"
                    style={{
                      background: CATEGORY_META[expense.category]?.bg ?? '#f0f0f0',
                      color: CATEGORY_META[expense.category]?.color ?? '#555',
                    }}
                  >{expense.category}</span>
                  <span className="expense-card__date">{formatExpenseDate(expense.expense_date)}</span>
                </div>
                {expense.gst > 0 && (
                  <span className="expense-card__gst">GST ${money(expense.gst)}</span>
                )}
              </div>
              <div style={{ position: 'relative', flexShrink: 0, alignSelf: 'flex-start' }}>
                <button
                  className="shift-menu-btn"
                  onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === expense.id ? null : expense.id) }}
                >
                  <MoreVertical size={16} />
                </button>
                {openMenuId === expense.id && (
                  <div className="shift-context-menu">
                    <button className="shift-context-item" onClick={() => { openEditExpense(expense); setOpenMenuId(null) }}>Edit</button>
                    <button className="shift-context-item danger" onClick={() => { deleteExpense(expense.id); setOpenMenuId(null) }}>Delete</button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Scanning overlay */}
      {isScanning && (
        <div className="expenses-scan-overlay">
          <div className="expenses-scan-card">
            <span className="expenses-spinner expenses-spinner--lg" />
            <p>Reading receipt…</p>
          </div>
        </div>
      )}

      {/* Add / Edit / Confirm modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={closeForm}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header-dark">
              <span className="modal-title-dark">
                {isConfirming ? 'Confirm receipt' : editingId ? 'Edit expense' : 'Add expense'}
              </span>
              <button className="modal-close-btn" onClick={closeForm}>✕</button>
            </div>

            {isDuplicate && (
              <div className="expenses-duplicate-warning">
                ⚠️ Looks like a duplicate — same vendor, amount and date already saved.
              </div>
            )}

            <div className="expenses-form">
              <label className="expenses-form__label">
                Vendor
                <input
                  className="expenses-form__input"
                  type="text"
                  placeholder="e.g. Uber, Apple, JB Hi-Fi"
                  value={draft.vendor}
                  onChange={e => setDraft({ ...draft, vendor: e.target.value })}
                />
              </label>

              <div className="expenses-form__row">
                <label className="expenses-form__label">
                  Amount (AUD)
                  <input
                    className="expenses-form__input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.amount || ''}
                    onChange={e => setDraft({ ...draft, amount: parseFloat(e.target.value) || 0 })}
                  />
                </label>
                <label className="expenses-form__label">
                  GST (AUD)
                  <input
                    className="expenses-form__input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.gst || ''}
                    onChange={e => setDraft({ ...draft, gst: parseFloat(e.target.value) || 0 })}
                  />
                </label>
              </div>

              <label className="expenses-form__label">
                Category
                <select
                  className="expenses-form__input expenses-form__select"
                  value={draft.category}
                  onChange={e => setDraft({ ...draft, category: e.target.value as ExpenseCategory })}
                >
                  {EXPENSE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </label>

              <label className="expenses-form__label">
                Date
                <input
                  className="expenses-form__input"
                  type="date"
                  value={draft.expense_date}
                  onChange={e => setDraft({ ...draft, expense_date: e.target.value })}
                />
              </label>

              <label className="expenses-form__label">
                Notes (optional)
                <input
                  className="expenses-form__input"
                  type="text"
                  placeholder="Optional note"
                  value={draft.description ?? ''}
                  onChange={e => setDraft({ ...draft, description: e.target.value })}
                />
              </label>

              <div className="expenses-form__actions">
                <button
                  className="expenses-form__cancel-btn"
                  onClick={closeForm}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  className="expenses-form__save-btn"
                  onClick={saveExpense}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

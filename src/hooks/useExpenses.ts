import { useState } from 'react'
import type { MutableRefObject } from 'react'
import { api } from '../api'
import type { Expense, ExpenseCategory, ExpenseDraft } from '../types'
import { EXPENSE_CATEGORIES } from '../types'

interface Deps {
  isMutatingRef: MutableRefObject<boolean>
}

export type ScanState = 'idle' | 'scanning' | 'confirming' | 'saving'

const defaultDraft = (): ExpenseDraft => ({
  vendor: '',
  amount: 0,
  gst: 0,
  category: 'Software & subscriptions' as ExpenseCategory,
  expense_date: new Date().toISOString().slice(0, 10),
  description: '',
})

export function useExpenses({ isMutatingRef }: Deps) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [scanError, setScanError] = useState<string | null>(null)
  const [isDuplicate, setIsDuplicate] = useState(false)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [draft, setDraft] = useState<ExpenseDraft>(defaultDraft())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)

  const loadExpenses = async () => {
    try {
      const data = await api.getExpenses()
      setExpenses(data)
    } catch (err) {
      console.error('Failed to load expenses', err)
    }
  }

  const handleReceiptFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setScanError('File is too large. Maximum size is 10 MB.')
      return
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'application/pdf']
    if (!allowed.includes(file.type) && !file.type.startsWith('image/')) {
      setScanError('Unsupported file type. Please upload an image or PDF.')
      return
    }
    isMutatingRef.current = true
    setScanState('scanning')
    try {
      const parsed = await api.scanReceipt(file)
      setDraft({
        vendor: parsed.vendor ?? '',
        amount: parsed.amount ?? 0,
        gst: parsed.gst ?? 0,
        category: (EXPENSE_CATEGORIES.includes(parsed.category as ExpenseCategory)
          ? parsed.category
          : 'Software & subscriptions') as ExpenseCategory,
        expense_date: parsed.expense_date ?? new Date().toISOString().slice(0, 10),
        description: '',
      })
      setEditingId(null)
      const dup = expenses.some(
        e => e.vendor === (parsed.vendor ?? '') &&
             e.amount === (parsed.amount ?? 0) &&
             e.expense_date === (parsed.expense_date ?? '')
      )
      setIsDuplicate(dup)
      setScanState('confirming')
    } catch (err: any) {
      console.error('Failed to scan receipt', err)
      const msg = err?.message === 'not_a_receipt'
        ? 'This doesn\'t look like a receipt. Please upload a receipt or invoice.'
        : 'Could not read the receipt. Try again or enter manually.'
      setScanError(msg)
      setScanState('idle')
    } finally {
      isMutatingRef.current = false
    }
  }

  const openAddExpense = () => {
    setDraft(defaultDraft())
    setEditingId(null)
    setIsFormOpen(true)
  }

  const openEditExpense = (expense: Expense) => {
    setDraft({
      vendor: expense.vendor,
      amount: expense.amount,
      gst: expense.gst,
      category: expense.category,
      expense_date: expense.expense_date,
      description: expense.description ?? '',
    })
    setEditingId(expense.id)
    setIsFormOpen(true)
  }

  const closeForm = () => {
    setIsFormOpen(false)
    setScanState('idle')
    setScanError(null)
    setIsDuplicate(false)
    setEditingId(null)
  }

  const saveExpense = async () => {
    if (!draft.amount || !draft.category || !draft.expense_date) {
      alert('Amount, category and date are required.')
      return
    }
    isMutatingRef.current = true
    setScanState('saving')
    try {
      if (editingId !== null) {
        await api.updateExpense(editingId, draft)
      } else {
        await api.createExpense(draft)
      }
      const fresh = await api.getExpenses()
      setExpenses(fresh)
      closeForm()
    } catch (err) {
      alert('Failed to save expense. Please try again.')
      console.error('Failed to save expense', err)
    } finally {
      isMutatingRef.current = false
      setScanState('idle')
    }
  }

  const deleteExpense = async (id: number) => {
    const ok = window.confirm('Delete this expense? This cannot be undone.')
    if (!ok) return
    isMutatingRef.current = true
    try {
      await api.deleteExpense(id)
      setExpenses(prev => prev.filter(e => e.id !== id))
    } catch (err) {
      alert('Failed to delete expense.')
      console.error('Failed to delete expense', err)
    } finally {
      isMutatingRef.current = false
    }
  }

  return {
    expenses,
    setExpenses,
    scanState,
    scanError,
    setScanError,
    isDuplicate,
    isCameraOpen,
    openCamera: () => setIsCameraOpen(true),
    closeCamera: () => setIsCameraOpen(false),
    draft,
    setDraft,
    editingId,
    isFormOpen,
    loadExpenses,
    handleReceiptFile,
    openAddExpense,
    openEditExpense,
    closeForm,
    saveExpense,
    deleteExpense,
  }
}

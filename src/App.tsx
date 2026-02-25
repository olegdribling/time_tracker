import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './App.css'
import {
  Banknote,
  ChevronLeft,
  ChevronRight,
  BarChart2,
  Clock,
  Coffee,
  FileText,
  Home,
  MoreVertical,
  Plus,
  User,
  Wrench,
  X,
} from 'lucide-react'
import { api } from './api'
import { calculateTotals, getPeriodByOffset, getPeriodRange, minutesBetween } from './lib/calculations'
import { generateInvoicePdf } from './lib/invoice'
import type { Client, ClientDraft, InvoiceProfile, Settings, Shift, ShiftForm } from './types'
import { saveAs } from 'file-saver'

const INITIAL_HOURLY_RATE = 25
const MENU_STORAGE_KEY = 'worktracker:menu-open'

const emptyForm = (): ShiftForm => {
  const today = new Date()
  const date = today.toISOString().slice(0, 10)
  return {
    date,
    start: '07:00',
    end: '17:00',
    lunchMinutes: 30,
    comment: '',
    clientId: null,
  }
}

function formatShortDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  const todayKey = toLocalDateKey(new Date())
  const yesterdayKey = toLocalDateKey(new Date(Date.now() - 86400000))
  if (value === todayKey) return 'Today'
  if (value === yesterdayKey) return 'Yesterday'
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function formatLunch(minutes: number) {
  if (minutes === 0) return 'No lunch'
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (m === 0) return `${h} hour${h > 1 ? 's' : ''}`
  return `${h}h ${m}m`
}

const DEFAULT_SETTINGS: Settings = {
  period: 'weekly',
  weekStart: 'monday',
  hourlyRate: INITIAL_HOURLY_RATE,
  weekendRateEnabled: false,
  weekendRate: INITIAL_HOURLY_RATE,
}

const DEFAULT_INVOICE_PROFILE: InvoiceProfile = {
  fullName: '',
  address: '',
  abn: '',
  speciality: '',
  accountBankName: '',
  bsb: '',
  accountNumber: '',
  nextInvoiceNumber: 1,
  chargeGst: false,
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function money(amount: number) {
  return amount.toLocaleString('en-AU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatDuration(minutes: number) {
  const safe = Math.max(minutes, 0)
  const hours = Math.floor(safe / 60)
  const mins = safe % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

const nowIso = () => new Date().toISOString()

const parseDecimal = (raw: string) => {
  const normalized = raw.replace(',', '.').trim()
  if (normalized === '') return null
  const num = Number(normalized)
  return Number.isFinite(num) ? num : null
}

type Option = {
  value: string
  label: string
}


const WEEKDAYS: Settings['weekStart'][] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]

const WEEKDAY_LABELS: Record<Settings['weekStart'], string> = {
  sunday: 'Sun',
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
}

const CALENDAR_WEEK_START: Settings['weekStart'] = 'monday'
const CALENDAR_WEEK_START_INDEX = WEEKDAYS.indexOf(CALENDAR_WEEK_START)

const pad2 = (value: number) => String(value).padStart(2, '0')

const toLocalDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`

const toMonthKey = (date: Date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`

const parseMonthKey = (value: string) => {
  const [yearRaw, monthRaw] = value.split('-')
  return {
    year: Number(yearRaw),
    month: Number(monthRaw),
  }
}

const shiftMonthKey = (value: string, offset: number) => {
  const { year, month } = parseMonthKey(value)
  const shifted = new Date(year, month - 1 + offset, 1)
  return toMonthKey(shifted)
}

type SettingsRowImport = Settings & { key?: string; updatedAt?: string }
type InvoiceRowImport = InvoiceProfile & { key?: string; updatedAt?: string }
type BackupPayload = {
  version: number
  exportedAt?: string
  shifts: (Shift & { updatedAt?: string })[]
  settings: SettingsRowImport[]
  invoiceProfile: InvoiceRowImport[]
}

type WheelPickerProps = {
  options: Option[]
  value: string
  onChange: (value: string) => void
  itemHeight?: number
}

const WheelPicker = ({ options, value, onChange, itemHeight = 44 }: WheelPickerProps) => {
  const ref = useRef<HTMLDivElement | null>(null)
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const viewportPadding = itemHeight
  const wheelHeight = itemHeight * 3
  const loopedOptions = useMemo(() => [...options, ...options, ...options], [options])
  const baseCount = options.length
  const middleOffset = baseCount

  useEffect(() => {
    if (!baseCount) return
    const index = Math.max(0, options.findIndex((item) => item.value === value))
    const targetIndex = middleOffset + index
    if (ref.current) {
      const target = Math.max(0, viewportPadding - itemHeight + targetIndex * itemHeight)
      ref.current.scrollTo({
        top: target,
        behavior: 'smooth',
      })
    }
  }, [value, options, itemHeight, viewportPadding, baseCount, middleOffset])

  const snapToNearest = () => {
    if (!ref.current || !baseCount) return
    const { scrollTop } = ref.current
    const relative = scrollTop - (viewportPadding - itemHeight)
    const index = Math.round(relative / itemHeight)
    const normalized = ((index % baseCount) + baseCount) % baseCount
    const targetIndex = middleOffset + normalized
    const target = Math.max(0, viewportPadding - itemHeight + targetIndex * itemHeight)
    // Only scroll if normalization is needed (infinite-loop reset); CSS snap handles visual snapping
    if (Math.abs(scrollTop - target) > 2) {
      ref.current.scrollTo({ top: target, behavior: 'instant' })
    }
    const selected = options[normalized]
    if (selected && selected.value !== value) {
      onChange(selected.value)
    }
  }

  const handleScroll = () => {
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current)
    scrollTimeout.current = setTimeout(snapToNearest, 80)
  }

  return (
    <div className="wheel" style={{ height: wheelHeight }}>
      <div className="wheel__mask" />
      <div
        className="wheel__viewport"
        ref={ref}
        onScroll={handleScroll}
        style={{
          paddingTop: viewportPadding,
          paddingBottom: viewportPadding,
        }}
      >
        {loopedOptions.map((option, idx) => (
          <div
            key={`${option.value}-${idx}`}
            className={`wheel__item ${option.value === value ? 'is-active' : ''}`}
            style={{ height: itemHeight }}
            translate="no"
          >
            {option.label}
          </div>
        ))}
      </div>
      <div className="wheel__highlight" style={{ height: itemHeight }} />
    </div>
  )
}

function App() {
  const navigate = useNavigate()
  const [shifts, setShifts] = useState<Shift[]>([])
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(() => {
    try {
      return localStorage.getItem(MENU_STORAGE_KEY) === 'true'
    } catch (error) {
      console.error('Failed to read stored menu state', error)
      return false
    }
  })
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false)
  const [isInvoiceScreenOpen, setIsInvoiceScreenOpen] = useState(false)
  const [isInvoiceEditing, setIsInvoiceEditing] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null)
  const [showEmailPrompt, setShowEmailPrompt] = useState(false)
  const [lastInvoiceNumber, setLastInvoiceNumber] = useState<number | null>(null)
  const [form, setForm] = useState<ShiftForm>(emptyForm)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [settingsDraft, setSettingsDraft] = useState<Settings>(DEFAULT_SETTINGS)
  const [hourlyRateInput, setHourlyRateInput] = useState(() => String(DEFAULT_SETTINGS.hourlyRate))
  const [weekendRateInput, setWeekendRateInput] = useState(() => String(DEFAULT_SETTINGS.weekendRate))
  const [invoiceProfile, setInvoiceProfile] = useState<InvoiceProfile>(DEFAULT_INVOICE_PROFILE)
  const [invoiceDraft, setInvoiceDraft] = useState<InvoiceProfile>(DEFAULT_INVOICE_PROFILE)
  const [invoiceForm, setInvoiceForm] = useState({
    invoiceNumber: 1,
    rate: INITIAL_HOURLY_RATE,
    durationMinutes: 0,
    total: 0,
  })
  const [invoiceNumberInput, setInvoiceNumberInput] = useState('1')
  const [invoiceRateInput, setInvoiceRateInput] = useState(() => String(INITIAL_HOURLY_RATE))
  const [invoiceTotalInput, setInvoiceTotalInput] = useState('0')
  const [nextInvoiceNumberInput, setNextInvoiceNumberInput] = useState('1')
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const [userEmail, setUserEmail] = useState<string>('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<'home' | 'reports' | 'calendar' | 'clients'>('home')
  const [clients, setClients] = useState<Client[]>([])
  const [isClientModalOpen, setIsClientModalOpen] = useState(false)
  const [editingClientId, setEditingClientId] = useState<number | null>(null)
  const [clientDraft, setClientDraft] = useState<ClientDraft>({ name: '', address: '', abn: '', email: '' })
  const [clientReturnContext, setClientReturnContext] = useState<'invoiceByTime' | 'invoiceByServices' | 'invoiceScreen' | null>(null)
  const [billingPlan, setBillingPlan] = useState<string>('trial')
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false)
  const [periodOffset, setPeriodOffset] = useState(0)
  const [reportClientId, setReportClientId] = useState<number | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(() => toMonthKey(new Date()))
  const [calendarSelectedDate, setCalendarSelectedDate] = useState(() => toLocalDateKey(new Date()))
  const [openMenuShiftId, setOpenMenuShiftId] = useState<string | null>(null)
  const [isFabOpen, setIsFabOpen] = useState(false)
  const [fabInvoiceOpen, setFabInvoiceOpen] = useState(false)
  const [isInvoiceByTimeOpen, setIsInvoiceByTimeOpen] = useState(false)
  const [isInvoiceByServicesOpen, setIsInvoiceByServicesOpen] = useState(false)
  const [invBSForm, setInvBSForm] = useState({ number: '1', date: toLocalDateKey(new Date()), clientId: null as number | null })
  const [invBSItems, setInvBSItems] = useState<{ id: number; description: string; amount: string }[]>([])
  const [invBSCalendarOpen, setInvBSCalendarOpen] = useState(false)
  const [invBSCalendarMonth, setInvBSCalendarMonth] = useState(() => toMonthKey(new Date()))
  const [invBTForm, setInvBTForm] = useState({
    number: '1',
    date: toLocalDateKey(new Date()),
    description: '',
    hours: '0',
    rate: '0',
    clientId: null as number | null,
  })
  const [invBTCalendarOpen, setInvBTCalendarOpen] = useState(false)
  const [invBTCalendarMonth, setInvBTCalendarMonth] = useState(() => toMonthKey(new Date()))
  const [activePickerField, setActivePickerField] = useState<'date' | 'start' | 'end' | 'lunch' | null>(null)
  const [formCalendarMonth, setFormCalendarMonth] = useState(() => toMonthKey(new Date()))
  const [clockDisplay, setClockDisplay] = useState(() => {
    const now = new Date()
    return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [shiftRows, settingsRow, invoiceRow, meRow, clientRows, billingRow] = await Promise.all([
          api.getShifts(),
          api.getSettings(),
          api.getInvoiceProfile(),
          api.me(),
          api.getClients(),
          api.getBillingStatus(),
        ])
        if (meRow?.email) setUserEmail(meRow.email)

        if (cancelled) return

        if (settingsRow) {
          const merged = {
            ...DEFAULT_SETTINGS,
            ...settingsRow,
          }
          setSettings(merged)
          setSettingsDraft(merged)
        } else {
          setSettings(DEFAULT_SETTINGS)
          setSettingsDraft(DEFAULT_SETTINGS)
          await api.saveSettings(DEFAULT_SETTINGS)
        }

        if (invoiceRow) {
          setInvoiceProfile({ ...invoiceRow, chargeGst: invoiceRow.chargeGst ?? false })
          setInvoiceDraft({ ...invoiceRow, chargeGst: invoiceRow.chargeGst ?? false })
        } else {
          setInvoiceProfile(DEFAULT_INVOICE_PROFILE)
          setInvoiceDraft(DEFAULT_INVOICE_PROFILE)
          await api.saveInvoiceProfile(DEFAULT_INVOICE_PROFILE)
        }

        setShifts(shiftRows)
        setClients(clientRows)
        if (billingRow?.plan) setBillingPlan(billingRow.plan)
      } catch (error) {
        console.error('Failed to load data', error)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(MENU_STORAGE_KEY, String(isMenuOpen))
    } catch (error) {
      console.error('Failed to persist menu preference', error)
    }
  }, [isMenuOpen])

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setClockDisplay(`${pad2(now.getHours())}:${pad2(now.getMinutes())}`)
    }
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    setHourlyRateInput(String(settingsDraft.hourlyRate))
  }, [settingsDraft.hourlyRate])

  useEffect(() => {
    setWeekendRateInput(String(settingsDraft.weekendRate))
  }, [settingsDraft.weekendRate])

  useEffect(() => {
    setNextInvoiceNumberInput(String(invoiceDraft.nextInvoiceNumber))
  }, [invoiceDraft.nextInvoiceNumber])

  const todayLabel = useMemo(() => {
    const now = new Date()
    return new Intl.DateTimeFormat('en-AU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now)
  }, [])

  const hourOptions = useMemo<Option[]>(
    () => Array.from({ length: 24 }, (_, i) => ({ value: String(i).padStart(2, '0'), label: String(i) })),
    [],
  )

  const minuteOptions = useMemo<Option[]>(
    () =>
      Array.from({ length: 12 }, (_, i) => i * 5).map((m) => ({
        value: String(m).padStart(2, '0'),
        label: String(m).padStart(2, '0'),
      })),
    [],
  )

  const lunchOptions = useMemo<Option[]>(
    () =>
      Array.from({ length: 25 }, (_, i) => i * 5).map((m) => ({
        value: String(m),
        label: String(m),
      })),
    [],
  )

  const updateTime = (field: 'start' | 'end', part: 'hour' | 'minute', value: string) => {
    setForm((prev) => {
      const [h, m] = prev[field].split(':')
      const next = part === 'hour' ? `${value}:${m}` : `${h}:${value}`
      return { ...prev, [field]: next }
    })
  }

  const sortedShifts = useMemo(
    () =>
      [...shifts].sort((a, b) =>
        a.date === b.date ? b.start.localeCompare(a.start) : b.date.localeCompare(a.date),
      ),
    [shifts],
  )

  const shiftGroups = useMemo(() => {
    const weekStartIndex = WEEKDAYS.indexOf(settings.weekStart)
    const now = new Date()
    const currentWeekStart = (() => {
      const d = new Date(now)
      const day = d.getDay()
      const diff = (day - weekStartIndex + 7) % 7
      d.setDate(d.getDate() - diff)
      d.setHours(0, 0, 0, 0)
      return d
    })()
    const getWeekLabel = (dateStr: string): string => {
      const d = new Date(`${dateStr}T00:00:00`)
      const day = d.getDay()
      const diff = (day - weekStartIndex + 7) % 7
      d.setDate(d.getDate() - diff)
      d.setHours(0, 0, 0, 0)
      const diffMs = currentWeekStart.getTime() - d.getTime()
      const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000))
      if (diffWeeks < 0) return 'Upcoming'
      if (diffWeeks === 0) return 'This Week'
      if (diffWeeks === 1) return 'Last Week'
      if (diffWeeks === 2) return '2 Weeks Ago'
      return `${diffWeeks} Weeks Ago`
    }
    const groupMap = new Map<string, Shift[]>()
    const labelOrder: string[] = []
    for (const shift of sortedShifts) {
      const label = getWeekLabel(shift.date)
      if (!groupMap.has(label)) {
        groupMap.set(label, [])
        labelOrder.push(label)
      }
      groupMap.get(label)!.push(shift)
    }
    return labelOrder.map(label => ({ label, shifts: groupMap.get(label)! }))
  }, [sortedShifts, settings.weekStart])

  const periodRange = useMemo(() => getPeriodRange(settings), [settings])

  const totals = useMemo(
    () => calculateTotals(shifts, periodRange),
    [shifts, periodRange],
  )

  const reportRange = useMemo(
    () => getPeriodByOffset(settings, periodOffset),
    [settings, periodOffset],
  )

  const reportShifts = useMemo(() => {
    const inRange = reportRange
      ? shifts.filter(s => s.date >= reportRange.start && s.date <= reportRange.end)
      : shifts
    return reportClientId !== null
      ? inRange.filter(s => s.clientId === reportClientId)
      : inRange
  }, [shifts, reportRange, reportClientId])

  const reportTotals = useMemo(
    () => calculateTotals(reportShifts, null),
    [reportShifts],
  )

  const reportLunchMinutes = useMemo(
    () => reportShifts.reduce((sum, s) => sum + s.lunchMinutes, 0),
    [reportShifts],
  )

  const totalPay = totals.pay
  const totalDurationMinutes = totals.durationMinutes

  const periodLabel = useMemo(() => {
    if (!periodRange) return 'All time'
    return `${formatDate(periodRange.start)} — ${formatDate(periodRange.end)}`
  }, [periodRange])

  const reportPeriodLabel = useMemo(() => {
    if (!reportRange) return 'All time'
    if (reportRange.start === reportRange.end) return formatDate(reportRange.start)
    return `${formatDate(reportRange.start)} — ${formatDate(reportRange.end)}`
  }, [reportRange])

  const canNavigateReports = true

  const calendarWeekLabels = useMemo(() => {
    return Array.from({ length: 7 }, (_, idx) => WEEKDAY_LABELS[WEEKDAYS[(CALENDAR_WEEK_START_INDEX + idx) % 7]])
  }, [])

  const calendarMonthLabel = useMemo(() => {
    const { year, month } = parseMonthKey(calendarMonth)
    return new Intl.DateTimeFormat('en-AU', {
      month: 'long',
      year: 'numeric',
    }).format(new Date(year, month - 1, 1))
  }, [calendarMonth])

  const calendarCells = useMemo(() => {
    const { year, month } = parseMonthKey(calendarMonth)
    const firstDay = new Date(year, month - 1, 1).getDay()
    const daysInMonth = new Date(year, month, 0).getDate()
    const leadingBlanks = (firstDay - CALENDAR_WEEK_START_INDEX + 7) % 7
    const totalCells = Math.ceil((leadingBlanks + daysInMonth) / 7) * 7
    const monthPrefix = `${year}-${pad2(month)}`
    const cells: Array<{ date: string | null; day: number | null }> = []

    for (let idx = 0; idx < totalCells; idx += 1) {
      const day = idx - leadingBlanks + 1
      if (day < 1 || day > daysInMonth) {
        cells.push({ date: null, day: null })
      } else {
        cells.push({
          date: `${monthPrefix}-${pad2(day)}`,
          day,
        })
      }
    }

    return cells
  }, [calendarMonth])

  const formCalendarCells = useMemo(() => {
    const { year, month } = parseMonthKey(formCalendarMonth)
    const firstDay = new Date(year, month - 1, 1).getDay()
    const daysInMonth = new Date(year, month, 0).getDate()
    const leadingBlanks = (firstDay - CALENDAR_WEEK_START_INDEX + 7) % 7
    const totalCells = Math.ceil((leadingBlanks + daysInMonth) / 7) * 7
    const monthPrefix = `${year}-${pad2(month)}`
    const cells: Array<{ date: string | null; day: number | null }> = []
    for (let idx = 0; idx < totalCells; idx += 1) {
      const day = idx - leadingBlanks + 1
      if (day < 1 || day > daysInMonth) {
        cells.push({ date: null, day: null })
      } else {
        cells.push({ date: `${monthPrefix}-${pad2(day)}`, day })
      }
    }
    return cells
  }, [formCalendarMonth])

  const formCalendarLabel = useMemo(() => {
    const { year, month } = parseMonthKey(formCalendarMonth)
    return new Intl.DateTimeFormat('en-AU', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
  }, [formCalendarMonth])

  const invBTCalendarCells = useMemo(() => {
    const { year, month } = parseMonthKey(invBTCalendarMonth)
    const firstDay = new Date(year, month - 1, 1).getDay()
    const daysInMonth = new Date(year, month, 0).getDate()
    const cells: { date: string | null; day: number | null }[] = []
    for (let i = 0; i < firstDay; i++) cells.push({ date: null, day: null })
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d })
    }
    return cells
  }, [invBTCalendarMonth])

  const invBTCalendarLabel = useMemo(() => {
    const { year, month } = parseMonthKey(invBTCalendarMonth)
    return new Intl.DateTimeFormat('en-AU', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
  }, [invBTCalendarMonth])

  const invBSCalendarCells = useMemo(() => {
    const { year, month } = parseMonthKey(invBSCalendarMonth)
    const firstDay = new Date(year, month - 1, 1).getDay()
    const daysInMonth = new Date(year, month, 0).getDate()
    const cells: { date: string | null; day: number | null }[] = []
    for (let i = 0; i < firstDay; i++) cells.push({ date: null, day: null })
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d })
    }
    return cells
  }, [invBSCalendarMonth])

  const invBSCalendarLabel = useMemo(() => {
    const { year, month } = parseMonthKey(invBSCalendarMonth)
    return new Intl.DateTimeFormat('en-AU', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
  }, [invBSCalendarMonth])

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, Shift[]>()
    shifts.forEach((shift) => {
      const current = map.get(shift.date) ?? []
      current.push(shift)
      map.set(shift.date, current)
    })
    map.forEach((items) => {
      items.sort((a, b) => b.start.localeCompare(a.start))
    })
    return map
  }, [shifts])

  const selectedDayShifts = useMemo(
    () => shiftsByDate.get(calendarSelectedDate) ?? [],
    [shiftsByDate, calendarSelectedDate],
  )

  const todayIso = useMemo(() => toLocalDateKey(new Date()), [])

  // Auto-select the only client when there's exactly one
  const soloClientId = clients.length === 1 ? clients[0].id : null

  const closeOverlays = () => {
    setIsMenuOpen(false)
    setIsSettingsOpen(false)
    setIsInvoiceModalOpen(false)
    setIsInvoiceScreenOpen(false)
    setShowEmailPrompt(false)
  }

  const openCreate = () => {
    closeOverlays()
    setEditingId(null)
    const f = { ...emptyForm(), clientId: soloClientId }
    setForm(f)
    setFormCalendarMonth(f.date.slice(0, 7))
    setActivePickerField(null)
    setIsAddOpen(true)
  }

  const openEdit = (shift: Shift) => {
    closeOverlays()
    setEditingId(shift.id)
    setActivePickerField(null)
    setFormCalendarMonth(shift.date.slice(0, 7))
    setForm({
      date: shift.date,
      start: shift.start,
      end: shift.end,
      lunchMinutes: shift.lunchMinutes,
      comment: shift.comment ?? '',
      clientId: shift.clientId ?? soloClientId,
    })
    setIsAddOpen(true)
  }

  const closeModal = () => {
    setIsAddOpen(false)
    setEditingId(null)
    setActivePickerField(null)
  }

  const openSettings = () => {
    closeOverlays()
    setSettingsDraft(settings)
    setIsSettingsOpen(true)
  }

  const openReports = () => {
    closeOverlays()
    setActiveView('reports')
    setPeriodOffset(0)
    setReportClientId(soloClientId)
  }

  const openClients = () => {
    closeOverlays()
    setActiveView('clients')
  }

  const openCalendar = (targetDate?: string) => {
    closeOverlays()
    const nextDate = targetDate ?? calendarSelectedDate ?? toLocalDateKey(new Date())
    setCalendarSelectedDate(nextDate)
    setCalendarMonth(nextDate.slice(0, 7))
    setActiveView('calendar')
  }

  const toggleCalendarFromHeader = () => {
    if (activeView === 'calendar') {
      goHome()
      return
    }
    openCalendar(todayIso)
  }

  const goPrevCalendarMonth = () => {
    setCalendarMonth((prev) => shiftMonthKey(prev, -1))
  }

  const goNextCalendarMonth = () => {
    setCalendarMonth((prev) => shiftMonthKey(prev, 1))
  }

  const exportData = async () => {
    try {
      const payload = {
        version: 1,
        exportedAt: nowIso(),
        shifts: shifts,
        settings: [settings],
        invoiceProfile: [invoiceProfile],
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const dateTag = payload.exportedAt.slice(0, 10)
      saveAs(blob, `worktracker-backup-${dateTag}.json`)
    } catch (error) {
      console.error('Failed to export data', error)
      alert('Failed to export data.')
    }
  }

  const triggerImport = () => {
    importInputRef.current?.click()
  }

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const confirm = window.confirm('Import will replace current data. Continue?')
    if (!confirm) return

    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as BackupPayload
      if (!parsed || !Array.isArray(parsed.shifts) || !Array.isArray(parsed.settings)) {
        throw new Error('Invalid backup format')
      }
      const shiftsData: Shift[] = parsed.shifts.map((s) => ({
        id: s.id,
        date: s.date,
        start: s.start,
        end: s.end,
        lunchMinutes: s.lunchMinutes,
        comment: s.comment,
        hourlyRate: s.hourlyRate,
      }))
      const mainSettings: Settings = parsed.settings[0] ?? DEFAULT_SETTINGS
      const mainInvoice: InvoiceProfile = Array.isArray(parsed.invoiceProfile) && parsed.invoiceProfile[0]
        ? { ...parsed.invoiceProfile[0], chargeGst: parsed.invoiceProfile[0].chargeGst ?? false }
        : DEFAULT_INVOICE_PROFILE

      await Promise.all([
        ...shiftsData.map((s) => api.createShift(s)),
        api.saveSettings(mainSettings),
        api.saveInvoiceProfile(mainInvoice),
      ])

      setShifts(shiftsData)
      setSettings(mainSettings)
      setSettingsDraft(mainSettings)
      setInvoiceProfile(mainInvoice)
      setInvoiceDraft(mainInvoice)
      setIsMenuOpen(false)
      alert('Import completed.')
    } catch (error) {
      console.error('Failed to import data', error)
      alert('Failed to import data.')
    }
  }

  const goHome = () => {
    closeOverlays()
    setActiveView('home')
  }

  const openAddClient = () => {
    if ((billingPlan === 'trial' || billingPlan === 'solo') && clients.length >= 1) {
      setIsUpgradeModalOpen(true)
      return
    }
    setEditingClientId(null)
    setClientDraft({ name: '', address: '', abn: '', email: '' })
    setClientReturnContext(null)
    setIsClientModalOpen(true)
  }

  const openAddClientFromInvoice = (context: 'invoiceByTime' | 'invoiceByServices' | 'invoiceScreen') => {
    if ((billingPlan === 'trial' || billingPlan === 'solo') && clients.length >= 1) {
      setIsUpgradeModalOpen(true)
      return
    }
    setEditingClientId(null)
    setClientDraft({ name: '', address: '', abn: '', email: '' })
    setClientReturnContext(context)
    // скрываем текущую инвойс-модалку пока создаём клиента
    if (context === 'invoiceByTime') setIsInvoiceByTimeOpen(false)
    if (context === 'invoiceByServices') setIsInvoiceByServicesOpen(false)
    if (context === 'invoiceScreen') setIsInvoiceScreenOpen(false)
    setIsClientModalOpen(true)
  }

  const openEditClient = (client: Client) => {
    setEditingClientId(client.id)
    setClientDraft({ name: client.name, address: client.address, abn: client.abn, email: client.email })
    setIsClientModalOpen(true)
  }

  const closeClientModal = () => {
    setIsClientModalOpen(false)
    setEditingClientId(null)
  }

  const saveClient = async () => {
    if (editingClientId !== null) {
      await api.updateClient(editingClientId, clientDraft)
      setClients(prev => prev.map(c => c.id === editingClientId ? { id: editingClientId, ...clientDraft } : c))
      setIsClientModalOpen(false)
      setClientReturnContext(null)
    } else {
      const data = await api.createClient(clientDraft)
      if (data.id) {
        const newClient = { id: data.id, ...clientDraft }
        setClients(prev => [...prev, newClient])
        setIsClientModalOpen(false)
        // возвращаемся в инвойс-модалку с выбранным клиентом
        if (clientReturnContext === 'invoiceByTime') {
          setInvBTForm(prev => ({ ...prev, clientId: data.id }))
          setIsInvoiceByTimeOpen(true)
        } else if (clientReturnContext === 'invoiceByServices') {
          setInvBSForm(prev => ({ ...prev, clientId: data.id }))
          setIsInvoiceByServicesOpen(true)
        } else if (clientReturnContext === 'invoiceScreen') {
          setSelectedClientId(data.id)
          setIsInvoiceScreenOpen(true)
        }
        setClientReturnContext(null)
      } else {
        setIsClientModalOpen(false)
        setClientReturnContext(null)
      }
    }
  }

  const handleDeleteClient = async (id: number) => {
    const ok = window.confirm('Remove this client? This cannot be undone.')
    if (!ok) return
    await api.deleteClient(id)
    setClients(prev => prev.filter(c => c.id !== id))
  }

  const goPrevPeriod = () => {
    if (!canNavigateReports) return
    setPeriodOffset((prev) => prev - 1)
  }

  const goNextPeriod = () => {
    if (!canNavigateReports) return
    setPeriodOffset((prev) => prev + 1)
  }

  const closeSettings = () => {
    setIsSettingsOpen(false)
  }

  const handleLogout = async () => {
    await api.logout()
    navigate('/login')
  }

  const handleDelete = async (id: string) => {
    const ok = window.confirm('Delete this shift?')
    if (!ok) return
    setShifts((prev) => prev.filter((shift) => shift.id !== id))
    try {
      await api.deleteShift(id)
    } catch (error) {
      console.error('Failed to delete shift', error)
    }
  }

  const handleSave = async () => {
    const workMinutes = minutesBetween(form.start, form.end) - form.lunchMinutes
    if (workMinutes < 0) {
      alert('End time must be after start time (minus lunch).')
      return
    }

    if (editingId) {
      const current = shifts.find((s) => s.id === editingId)
      const updated: Shift = {
        ...(current ?? {
          id: editingId,
          date: form.date,
          start: form.start,
          end: form.end,
          lunchMinutes: form.lunchMinutes,
          comment: form.comment.trim(),
          hourlyRate: settings.hourlyRate,
          clientId: form.clientId,
        }),
        date: form.date,
        start: form.start,
        end: form.end,
        lunchMinutes: form.lunchMinutes,
        comment: form.comment.trim(),
        clientId: form.clientId,
      }
      setShifts((prev) =>
        prev.map((shift) =>
          shift.id === editingId ? updated : shift,
        ),
      )
      try {
        await api.updateShift(updated)
      } catch (error) {
        console.error('Failed to update shift', error)
      }
    } else {
      const dayOfWeek = new Date(`${form.date}T00:00:00`).getDay()
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
      const rateToUse = settings.weekendRateEnabled && isWeekend ? settings.weekendRate : settings.hourlyRate
      const newShift: Shift = {
        id: crypto.randomUUID(),
        date: form.date,
        start: form.start,
        end: form.end,
        lunchMinutes: form.lunchMinutes,
        comment: form.comment.trim(),
        hourlyRate: rateToUse,
        clientId: form.clientId,
      }
      setShifts((prev) => [...prev, newShift])
      try {
        await api.createShift(newShift)
      } catch (error) {
        console.error('Failed to add shift', error)
      }
    }

    closeModal()
  }

  const saveSettings = async () => {
    setSettings(settingsDraft)
    setPeriodOffset(0)
    try {
      await api.saveSettings(settingsDraft)
    } catch (error) {
      console.error('Failed to save settings', error)
    }
    closeSettings()
  }

  const openInvoiceModal = () => {
    closeOverlays()
    setInvoiceDraft(invoiceProfile)
    setIsInvoiceModalOpen(true)
  }

  const closeInvoiceModal = () => {
    setIsInvoiceModalOpen(false)
  }

  const saveInvoiceProfile = async () => {
    setInvoiceProfile(invoiceDraft)
    try {
      await api.saveInvoiceProfile(invoiceDraft)
    } catch (error) {
      console.error('Failed to save invoice profile', error)
    }
    closeInvoiceModal()
  }

  const hasInvoiceCoreFields = invoiceProfile.fullName.trim() !== '' && invoiceProfile.accountNumber.trim() !== ''

  const closeInvoiceScreen = () => {
    setIsInvoiceScreenOpen(false)
    setIsInvoiceEditing(false)
    setShowEmailPrompt(false)
  }

  const openInvoiceByTime = () => {
    const hours = Math.max(reportTotals.durationMinutes, 0) / 60
    const today = toLocalDateKey(new Date())
    setInvBTForm({
      number: String(invoiceProfile.nextInvoiceNumber),
      date: today,
      description: invoiceProfile.speciality || 'Work shift',
      hours: String(Math.round(hours * 100) / 100),
      rate: String(settings.hourlyRate),
      clientId: reportClientId ?? soloClientId,
    })
    setInvBTCalendarMonth(toMonthKey(new Date()))
    setInvBTCalendarOpen(false)
    setIsFabOpen(false)
    setFabInvoiceOpen(false)
    setIsInvoiceByTimeOpen(true)
  }

  const generateInvoiceByTime = async () => {
    const hours = parseFloat(invBTForm.hours) || 0
    const rate = parseFloat(invBTForm.rate) || 0
    const subtotal = hours * rate
    const gst = invoiceProfile.chargeGst ? subtotal * 0.1 : 0
    const total = subtotal + gst
    const invNum = parseInt(invBTForm.number) || 1
    const period = reportRange ?? { start: invBTForm.date, end: invBTForm.date }
    const selectedClient = clients.find(c => c.id === invBTForm.clientId)
    try {
      await generateInvoicePdf({
        profile: invoiceProfile,
        period,
        invoiceNumber: invNum,
        itemLabel: invBTForm.description,
        unitPrice: rate,
        quantityMinutes: hours * 60,
        subtotal,
        gst,
        balanceDue: total,
        billTo: selectedClient ? { name: selectedClient.name, address: selectedClient.address, abn: selectedClient.abn } : undefined,
      })
      const nextNumber = invNum >= invoiceProfile.nextInvoiceNumber ? invNum + 1 : invoiceProfile.nextInvoiceNumber + 1
      const updated: InvoiceProfile = { ...invoiceProfile, nextInvoiceNumber: nextNumber }
      setInvoiceProfile(updated)
      setInvoiceDraft(updated)
      await api.saveInvoiceProfile(updated)
      setIsInvoiceByTimeOpen(false)
    } catch (error) {
      console.error('Failed to generate invoice', error)
      alert('Failed to generate invoice.')
    }
  }

  const saveInvoicePdf = async () => {
    if (!reportRange) return
    const lineItem = invoiceProfile.speciality || 'Service'
    const invoiceNumber = invoiceForm.invoiceNumber
    const gst = invoiceProfile.chargeGst ? invoiceForm.total / 11 : 0
    const unitPrice = invoiceProfile.chargeGst ? invoiceForm.rate / 1.1 : invoiceForm.rate
    const netSubtotal = invoiceForm.total - gst
    const balanceDue = invoiceForm.total
    try {
      const selectedClient = clients.find(c => c.id === selectedClientId)
      await generateInvoicePdf({
        profile: invoiceProfile,
        period: reportRange,
        invoiceNumber,
        itemLabel: lineItem,
        unitPrice,
        quantityMinutes: invoiceForm.durationMinutes,
        subtotal: netSubtotal,
        gst,
        balanceDue,
        billTo: selectedClient ? { name: selectedClient.name, address: selectedClient.address, abn: selectedClient.abn } : undefined,
      })
      const nextNumber =
        invoiceNumber > invoiceProfile.nextInvoiceNumber
          ? invoiceNumber + 1
          : invoiceProfile.nextInvoiceNumber + 1
      const updated: InvoiceProfile = { ...invoiceProfile, nextInvoiceNumber: nextNumber }
      setInvoiceProfile(updated)
      setInvoiceDraft(updated)
      await api.saveInvoiceProfile(updated)
      setLastInvoiceNumber(invoiceNumber)
      closeInvoiceScreen()
      setShowEmailPrompt(true)
    } catch (error) {
      console.error('Failed to generate invoice', error)
      alert('Failed to generate invoice. See console for details.')
    }
  }

  const openInvoiceByServices = () => {
    setInvBSForm({
      number: String(invoiceProfile.nextInvoiceNumber),
      date: toLocalDateKey(new Date()),
      clientId: reportClientId ?? soloClientId,
    })
    setInvBSItems([{ id: 1, description: 'Services', amount: '0' }])
    setInvBSCalendarMonth(toMonthKey(new Date()))
    setInvBSCalendarOpen(false)
    setIsFabOpen(false)
    setFabInvoiceOpen(false)
    setIsInvoiceByServicesOpen(true)
  }

  const generateInvoiceByServices = async () => {
    const items = invBSItems.map(i => ({ description: i.description, amount: parseFloat(i.amount) || 0 }))
    const subtotal = items.reduce((s, i) => s + i.amount, 0)
    const gst = invoiceProfile.chargeGst ? subtotal * 0.1 : 0
    const total = subtotal + gst
    const invNum = parseInt(invBSForm.number) || 1
    const period = reportRange ?? { start: invBSForm.date, end: invBSForm.date }
    const selectedClient = clients.find(c => c.id === invBSForm.clientId)
    try {
      await generateInvoicePdf({
        profile: invoiceProfile,
        period,
        invoiceNumber: invNum,
        itemLabel: '',
        unitPrice: 0,
        quantityMinutes: 0,
        subtotal,
        gst,
        balanceDue: total,
        billTo: selectedClient ? { name: selectedClient.name, address: selectedClient.address, abn: selectedClient.abn } : undefined,
        lineItems: items,
      })
      const nextNumber = invNum >= invoiceProfile.nextInvoiceNumber ? invNum + 1 : invoiceProfile.nextInvoiceNumber + 1
      const updated: InvoiceProfile = { ...invoiceProfile, nextInvoiceNumber: nextNumber }
      setInvoiceProfile(updated)
      setInvoiceDraft(updated)
      await api.saveInvoiceProfile(updated)
      setIsInvoiceByServicesOpen(false)
    } catch (error) {
      console.error('Failed to generate invoice', error)
      alert('Failed to generate invoice.')
    }
  }

  const openEmailDraft = () => {
    if (!reportRange) {
      alert('Select a reporting period first.')
      return
    }
    const selectedClient = clients.find(c => c.id === selectedClientId)
    if (!selectedClient?.email) {
      alert('Select a client with an email address to send the invoice.')
      return
    }
    const invNumber = lastInvoiceNumber ?? invoiceForm.invoiceNumber
    const subject = `Invoice #${invNumber} - ${invoiceProfile.fullName || 'Invoice'}`
    const mailto = `mailto:${encodeURIComponent(selectedClient.email)}?subject=${encodeURIComponent(subject)}`
    window.location.href = mailto
  }

  return (
    <div className="app-shell" onClick={() => { if (openMenuShiftId) setOpenMenuShiftId(null) }}>
      <input
        type="file"
        accept="application/json"
        ref={importInputRef}
        style={{ display: 'none' }}
        onChange={handleImportFile}
      />

      {/* HEADER */}
      <header className="top-bar">
        <button
          type="button"
          className="date-block date-trigger"
          aria-label="Open calendar"
          onClick={toggleCalendarFromHeader}
        >
          <div className="today-label">{clockDisplay}</div>
          <div className="today-value">{todayLabel}</div>
        </button>
        <button
          className="burger"
          aria-label="Menu"
          onClick={() => setIsMenuOpen(true)}
        >
          <span />
          <span />
          <span />
        </button>
      </header>

      {/* RIGHT SLIDE-IN MENU PANEL */}
      {isMenuOpen && (
        <>
          <div className="menu-overlay" onClick={() => setIsMenuOpen(false)} />
          <div className="menu-panel">
            <div className="menu-panel-header">
              <div className="menu-panel-avatar"><User size={20} /></div>
              <div className="menu-panel-email">{userEmail || 'Account'}</div>
              <button className="menu-panel-close" onClick={() => setIsMenuOpen(false)}><X size={18} /></button>
            </div>
            <div className="menu-panel-items">
              <button className="menu-panel-item" onClick={openClients}>Clients</button>
              <button className="menu-panel-item" onClick={openSettings}>Settings</button>
              <button className="menu-panel-item" onClick={openInvoiceModal}>Invoice details</button>
              <button className="menu-panel-item" onClick={exportData}>Export data</button>
              <button className="menu-panel-item" onClick={triggerImport}>Import data</button>
              <button className="menu-panel-item" onClick={() => { setIsMenuOpen(false); navigate('/app/billing') }}>Subscription</button>
              <hr className="menu-panel-divider" />
              <button className="menu-panel-item danger" onClick={handleLogout}>Log out</button>
            </div>
          </div>
        </>
      )}

      {/* INVOICE SCREEN MODAL */}
      {isInvoiceScreenOpen && (
        <div className="modal-backdrop" onClick={closeInvoiceScreen}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-dark">
              <div className="modal-title-dark">Create Invoice</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
                  onClick={() => setIsInvoiceEditing((prev) => !prev)}
                >
                  {isInvoiceEditing ? 'Lock' : 'Edit'}
                </button>
                <button className="modal-close-btn" onClick={closeInvoiceScreen}><X size={18} /></button>
              </div>
            </div>

            <div className="form-grid">
              <div className="field">
                <div className="field-label-row">
                  <span className="label">Client</span>
                  <button type="button" className="add-action-btn" onClick={() => openAddClientFromInvoice('invoiceScreen')}>+ Add Client</button>
                </div>
                <select
                  value={selectedClientId ?? ''}
                  onChange={e => setSelectedClientId(e.target.value ? Number(e.target.value) : null)}
                >
                  {clients.length !== 1 && <option value="">Select Client</option>}
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <span className="label">Invoice number</span>
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*"
                  value={invoiceNumberInput}
                  disabled={!isInvoiceEditing}
                  onChange={(e) => {
                    const raw = e.target.value
                    setInvoiceNumberInput(raw)
                    const parsed = parseDecimal(raw)
                    if (parsed !== null) {
                      setInvoiceForm((prev) => ({ ...prev, invoiceNumber: Math.max(1, Math.round(parsed)) }))
                    }
                  }}
                  onBlur={(e) => {
                    const parsed = parseDecimal(e.target.value)
                    const safe = Math.max(1, parsed ?? invoiceForm.invoiceNumber ?? 1)
                    const rounded = Math.round(safe)
                    setInvoiceNumberInput(String(rounded))
                    setInvoiceForm((prev) => ({ ...prev, invoiceNumber: rounded }))
                  }}
                />
              </div>

              <div className="double">
                <label className="field">
                  <span className="label">Total duration</span>
                  <input
                    type="text"
                    value={`${Math.floor(invoiceForm.durationMinutes / 60)}h ${invoiceForm.durationMinutes % 60}m`}
                    disabled
                  />
                </label>
                <label className="field">
                  <span className="label">Hourly rate</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*[.,]?[0-9]*"
                    value={invoiceRateInput}
                    disabled={!isInvoiceEditing}
                    onChange={(e) => {
                      const raw = e.target.value
                      setInvoiceRateInput(raw)
                      const parsed = parseDecimal(raw)
                      if (parsed !== null) {
                        setInvoiceForm((prev) => ({ ...prev, rate: Math.max(0, parsed) }))
                      }
                    }}
                    onBlur={(e) => {
                      const parsed = parseDecimal(e.target.value)
                      const safe = Math.max(0, parsed ?? invoiceForm.rate ?? 0)
                      setInvoiceRateInput(String(safe))
                      setInvoiceForm((prev) => ({ ...prev, rate: safe }))
                    }}
                  />
                </label>
              </div>

              <label className="field">
                <span className="label">Total amount</span>
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*[.,]?[0-9]*"
                  value={invoiceTotalInput}
                  disabled={!isInvoiceEditing}
                  onChange={(e) => {
                    const raw = e.target.value
                    setInvoiceTotalInput(raw)
                    const parsed = parseDecimal(raw)
                    if (parsed !== null) {
                      setInvoiceForm((prev) => ({ ...prev, total: Math.max(0, parsed) }))
                    }
                  }}
                  onBlur={(e) => {
                    const parsed = parseDecimal(e.target.value)
                    const safe = Math.max(0, parsed ?? invoiceForm.total ?? 0)
                    setInvoiceTotalInput(String(safe))
                    setInvoiceForm((prev) => ({ ...prev, total: safe }))
                  }}
                />
              </label>
            </div>

            <button className="primary-btn" onClick={saveInvoicePdf} disabled={selectedClientId === null}>
              Save
            </button>
          </div>
        </div>
      )}

      {/* INVOICE BY TIME MODAL */}
      {isInvoiceByTimeOpen && (
        <div className="modal-backdrop" onClick={() => setIsInvoiceByTimeOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="inv-header">
              <div className="inv-header-left">
                <FileText size={20} />
                <span className="inv-header-title">Create Invoice</span>
              </div>
              <button className="inv-close-btn" onClick={() => setIsInvoiceByTimeOpen(false)}><X size={18} /></button>
            </div>

            <div className="form-grid">
              <div>
                <div className="inv-section-title">INVOICE DETAILS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
                  <div className="field">
                    <span className="label">Invoice Number</span>
                    <input
                      type="text"
                      value={`INV-${String(invBTForm.number).padStart(3, '0')}`}
                      onChange={e => {
                        const raw = e.target.value.replace(/^INV-0*/, '').replace(/\D/g, '')
                        setInvBTForm(prev => ({ ...prev, number: raw || '1' }))
                      }}
                    />
                  </div>
                  <div className="field">
                    <span className="label">Date</span>
                    <button
                      type="button"
                      className="form-field-btn"
                      onClick={() => setInvBTCalendarOpen(prev => !prev)}
                    >
                      {formatDate(invBTForm.date)}
                    </button>
                    {invBTCalendarOpen && (
                      <div className="form-calendar">
                        <div className="form-calendar-header">
                          <button type="button" className="nav-btn" onClick={() => setInvBTCalendarMonth(prev => shiftMonthKey(prev, -1))}><ChevronLeft size={16} /></button>
                          <span className="form-calendar-title">{invBTCalendarLabel}</span>
                          <button type="button" className="nav-btn" onClick={() => setInvBTCalendarMonth(prev => shiftMonthKey(prev, 1))}><ChevronRight size={16} /></button>
                        </div>
                        <div className="calendar-weekdays">
                          {calendarWeekLabels.map(l => <div key={l} className="calendar-weekday">{l}</div>)}
                        </div>
                        <div className="calendar-grid">
                          {invBTCalendarCells.map((cell, idx) => {
                            if (!cell.date || !cell.day) return <div key={`invbt-${idx}`} className="calendar-day-empty" />
                            const isSelected = cell.date === invBTForm.date
                            const isToday = cell.date === todayIso
                            return (
                              <button
                                key={cell.date}
                                type="button"
                                className={`calendar-day${isSelected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}`}
                                onClick={() => {
                                  setInvBTForm(prev => ({ ...prev, date: cell.date! }))
                                  setInvBTCalendarOpen(false)
                                }}
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
                      <button type="button" className="add-action-btn" onClick={() => openAddClientFromInvoice('invoiceByTime')}>+ Add Client</button>
                    </div>
                    <select
                      value={invBTForm.clientId ?? ''}
                      onChange={e => setInvBTForm(prev => ({ ...prev, clientId: e.target.value ? Number(e.target.value) : null }))}
                    >
                      {clients.length !== 1 && <option value="">Select Client</option>}
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <div className="inv-section-title">LINE ITEMS</div>
                <div className="inv-line-item-card" style={{ marginTop: 14 }}>
                  <div className="inv-item-title">Item 1</div>
                  <div className="field">
                    <span className="label">Description</span>
                    <input
                      type="text"
                      value={invBTForm.description}
                      onChange={e => setInvBTForm(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                  <div className="double">
                    <div className="field">
                      <span className="label">Hours</span>
                      <input
                        type="text"
                        value={invBTForm.hours}
                        onChange={e => setInvBTForm(prev => ({ ...prev, hours: e.target.value }))}
                      />
                    </div>
                    <div className="field">
                      <span className="label">Rate ($/hr)</span>
                      <input
                        type="text"
                        value={invBTForm.rate}
                        onChange={e => setInvBTForm(prev => ({ ...prev, rate: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="inv-item-amount">
                    <span>Amount</span>
                    <strong>${money((parseFloat(invBTForm.hours) || 0) * (parseFloat(invBTForm.rate) || 0))}</strong>
                  </div>
                </div>
              </div>

              {(() => {
                const subtotal = (parseFloat(invBTForm.hours) || 0) * (parseFloat(invBTForm.rate) || 0)
                const gst = invoiceProfile.chargeGst ? subtotal * 0.1 : 0
                const total = subtotal + gst
                return (
                  <div className="inv-summary-card">
                    <div className="inv-summary-row">
                      <span>Subtotal</span>
                      <span>${money(subtotal)}</span>
                    </div>
                    {invoiceProfile.chargeGst && (
                      <div className="inv-summary-row">
                        <span>GST (10%)</span>
                        <span>${money(gst)}</span>
                      </div>
                    )}
                    <div className="inv-summary-divider" />
                    <div className="inv-summary-row inv-summary-total">
                      <strong>Total</strong>
                      <strong>${money(total)}</strong>
                    </div>
                  </div>
                )
              })()}
            </div>

            <div className="inv-footer">
              <button className="ghost-button" onClick={() => setIsInvoiceByTimeOpen(false)}>Cancel</button>
              <button className="primary-btn" style={{ flex: 1 }} onClick={generateInvoiceByTime} disabled={invBTForm.clientId === null}>
                Generate Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INVOICE BY SERVICES MODAL */}
      {isInvoiceByServicesOpen && (
        <div className="modal-backdrop" onClick={() => setIsInvoiceByServicesOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="inv-header">
              <div className="inv-header-left">
                <FileText size={20} />
                <span className="inv-header-title">Create Invoice</span>
              </div>
              <button className="inv-close-btn" onClick={() => setIsInvoiceByServicesOpen(false)}><X size={18} /></button>
            </div>

            <div className="form-grid">
              <div>
                <div className="inv-section-title">INVOICE DETAILS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
                  <div className="field">
                    <span className="label">Invoice Number</span>
                    <input
                      type="text"
                      value={`INV-${String(invBSForm.number).padStart(3, '0')}`}
                      onChange={e => {
                        const raw = e.target.value.replace(/^INV-0*/, '').replace(/\D/g, '')
                        setInvBSForm(prev => ({ ...prev, number: raw || '1' }))
                      }}
                    />
                  </div>
                  <div className="field">
                    <span className="label">Date</span>
                    <button
                      type="button"
                      className="form-field-btn"
                      onClick={() => setInvBSCalendarOpen(prev => !prev)}
                    >
                      {formatDate(invBSForm.date)}
                    </button>
                    {invBSCalendarOpen && (
                      <div className="form-calendar">
                        <div className="form-calendar-header">
                          <button type="button" className="nav-btn" onClick={() => setInvBSCalendarMonth(prev => shiftMonthKey(prev, -1))}><ChevronLeft size={16} /></button>
                          <span className="form-calendar-title">{invBSCalendarLabel}</span>
                          <button type="button" className="nav-btn" onClick={() => setInvBSCalendarMonth(prev => shiftMonthKey(prev, 1))}><ChevronRight size={16} /></button>
                        </div>
                        <div className="calendar-weekdays">
                          {calendarWeekLabels.map(l => <div key={l} className="calendar-weekday">{l}</div>)}
                        </div>
                        <div className="calendar-grid">
                          {invBSCalendarCells.map((cell, idx) => {
                            if (!cell.date || !cell.day) return <div key={`invbs-${idx}`} className="calendar-day-empty" />
                            const isSelected = cell.date === invBSForm.date
                            const isToday = cell.date === todayIso
                            return (
                              <button
                                key={cell.date}
                                type="button"
                                className={`calendar-day${isSelected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}`}
                                onClick={() => {
                                  setInvBSForm(prev => ({ ...prev, date: cell.date! }))
                                  setInvBSCalendarOpen(false)
                                }}
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
                      <button type="button" className="add-action-btn" onClick={() => openAddClientFromInvoice('invoiceByServices')}>+ Add Client</button>
                    </div>
                    <select
                      value={invBSForm.clientId ?? ''}
                      onChange={e => setInvBSForm(prev => ({ ...prev, clientId: e.target.value ? Number(e.target.value) : null }))}
                    >
                      {clients.length !== 1 && <option value="">Select Client</option>}
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <div className="inv-section-title-row">
                  <div className="inv-section-title">LINE ITEMS</div>
                  <button
                    type="button"
                    className="add-action-btn"
                    onClick={() => {
                      const newId = invBSItems.length > 0 ? Math.max(...invBSItems.map(i => i.id)) + 1 : 1
                      setInvBSItems(prev => [...prev, { id: newId, description: '', amount: '0' }])
                    }}
                  >
                    + Add Item
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
                  {invBSItems.map((item, idx) => (
                    <div key={item.id} className="inv-line-item-card">
                      <div className="inv-item-title-row">
                        <div className="inv-item-title">Item {idx + 1}</div>
                        {invBSItems.length > 1 && (
                          <button
                            type="button"
                            className="inv-remove-item-btn"
                            onClick={() => setInvBSItems(prev => prev.filter(i => i.id !== item.id))}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      <div className="field">
                        <span className="label">Description</span>
                        <input
                          type="text"
                          value={item.description}
                          onChange={e => setInvBSItems(prev => prev.map(i => i.id === item.id ? { ...i, description: e.target.value } : i))}
                        />
                      </div>
                      <div className="field">
                        <span className="label">Amount ($)</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.amount}
                          onChange={e => setInvBSItems(prev => prev.map(i => i.id === item.id ? { ...i, amount: e.target.value } : i))}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {(() => {
                const subtotal = invBSItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
                const gst = invoiceProfile.chargeGst ? subtotal * 0.1 : 0
                const total = subtotal + gst
                return (
                  <div className="inv-summary-card">
                    <div className="inv-summary-row">
                      <span>Subtotal</span>
                      <span>${money(subtotal)}</span>
                    </div>
                    {invoiceProfile.chargeGst && (
                      <div className="inv-summary-row">
                        <span>GST (10%)</span>
                        <span>${money(gst)}</span>
                      </div>
                    )}
                    <div className="inv-summary-divider" />
                    <div className="inv-summary-row inv-summary-total">
                      <strong>Total</strong>
                      <strong>${money(total)}</strong>
                    </div>
                  </div>
                )
              })()}
            </div>

            <div className="inv-footer">
              <button className="ghost-button" onClick={() => setIsInvoiceByServicesOpen(false)}>Cancel</button>
              <button className="primary-btn" style={{ flex: 1 }} onClick={generateInvoiceByServices} disabled={invBSForm.clientId === null}>
                Generate Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SEND EMAIL PROMPT */}
      {showEmailPrompt && (
        <div className="modal-backdrop" onClick={() => { setShowEmailPrompt(false); setActiveView('home') }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-dark">
              <div className="modal-title-dark">Send invoice</div>
              <button className="modal-close-btn" onClick={() => { setShowEmailPrompt(false); setActiveView('home') }}><X size={18} /></button>
            </div>
            <div className="actions-row" style={{ padding: '16px 0 8px' }}>
              <button className="ghost-button" onClick={openEmailDraft}>
                Open email draft
              </button>
              <button
                className="primary-btn"
                onClick={() => {
                  setShowEmailPrompt(false)
                  setActiveView('home')
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="content">
        {activeView === 'home' ? (
          <>
            <section className="overview">
              <div className="overview-label">Total payout</div>
              <div className="overview-period">{periodLabel}</div>
              <div className="overview-value">${money(totalPay)} AUD</div>
              <div className="overview-sub">Duration: {formatDuration(totalDurationMinutes)}</div>
              <div className="overview-sub">Rate: {settings.hourlyRate} AUD/hr</div>
            </section>

            <div className="shift-list">
              {shiftGroups.length === 0 && (
                <div className="report-row empty">No shifts yet. Add your first shift.</div>
              )}
              {shiftGroups.map((group) => (
                <div key={group.label}>
                  <div className="section-header">{group.label}</div>
                  {group.shifts.map((shift) => {
                    const workedMinutes = minutesBetween(shift.start, shift.end) - shift.lunchMinutes
                    const hours = Math.max(workedMinutes, 0) / 60
                    const salary = hours * shift.hourlyRate
                    return (
                      <article key={shift.id} className="shift-card">
                        <div className="shift-card__header">
                          <div className="shift-date">{formatShortDate(shift.date)}</div>
                          <div style={{ position: 'relative' }}>
                            <button
                              className="shift-menu-btn"
                              onClick={(e) => { e.stopPropagation(); setOpenMenuShiftId(openMenuShiftId === shift.id ? null : shift.id) }}
                            >
                              <MoreVertical size={16} />
                            </button>
                            {openMenuShiftId === shift.id && (
                              <div className="shift-context-menu">
                                <button className="shift-context-item" onClick={() => { openEdit(shift); setOpenMenuShiftId(null) }}>Edit</button>
                                <button className="shift-context-item" onClick={() => { openReports(); setOpenMenuShiftId(null) }}>Create Invoice</button>
                                <button className="shift-context-item danger" onClick={() => { handleDelete(shift.id); setOpenMenuShiftId(null) }}>Delete</button>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="shift-info-row">
                          <div className="shift-icon-item">
                            <div className="shift-icon-badge clock"><Clock size={16} /></div>
                            {shift.start}–{shift.end}
                          </div>
                          <div className="shift-icon-item">
                            <div className="shift-icon-badge lunch"><Coffee size={16} /></div>
                            {formatLunch(shift.lunchMinutes)}
                          </div>
                          <div className="shift-icon-item">
                            <div className="shift-icon-badge money"><Banknote size={16} /></div>
                            <span className="shift-pay">${money(salary)}</span>
                          </div>
                        </div>
                        {shift.comment && <div className="comment">"{shift.comment}"</div>}
                      </article>
                    )
                  })}
                </div>
              ))}
            </div>
          </>
        ) : activeView === 'reports' ? (
          <section className="reports-page">
            {/* Header */}
            <div className="reports-header">
              <div className="reports-period-label">REPORTING<br />PERIOD</div>
              <div className="reports-nav-row">
                <button className="nav-btn" onClick={goPrevPeriod}><ChevronLeft size={16} /></button>
                <div className="reports-range">
                  {reportRange && reportRange.start !== reportRange.end ? (
                    <>
                      <span>{formatDate(reportRange.start)}</span>
                      <span>{formatDate(reportRange.end)}</span>
                    </>
                  ) : reportPeriodLabel}
                </div>
                <button className="nav-btn" onClick={goNextPeriod}><ChevronRight size={16} /></button>
              </div>
            </div>

            {/* Client filter */}
            <div className="reports-client-wrap">
              <select
                className="reports-client-select"
                value={reportClientId ?? ''}
                onChange={e => setReportClientId(e.target.value === '' ? null : Number(e.target.value))}
              >
                {clients.length !== 1 && <option value="">All Clients</option>}
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Create Invoice button */}
            <button
              className="reports-create-invoice-btn"
              onClick={openInvoiceByTime}
              disabled={reportClientId === null || !hasInvoiceCoreFields || reportShifts.length === 0}
            >
              <FileText size={18} />
              Invoice by Period
            </button>

            {/* Stats */}
            <div className="reports-stats-card">
              <div className="reports-stat-item">
                <div className="reports-stat-icon"><Clock size={20} /></div>
                <div className="reports-stat-label">Work</div>
                <div className="reports-stat-value">{formatDuration(reportTotals.durationMinutes)}</div>
              </div>
              <div className="reports-stat-divider" />
              <div className="reports-stat-item">
                <div className="reports-stat-icon"><Coffee size={20} /></div>
                <div className="reports-stat-label">Lunch</div>
                <div className="reports-stat-value">{formatLunch(reportLunchMinutes)}</div>
              </div>
              <div className="reports-stat-divider" />
              <div className="reports-stat-item">
                <div className="reports-stat-icon"><Banknote size={20} /></div>
                <div className="reports-stat-label">Earnings</div>
                <div className="reports-stat-value">${money(reportTotals.pay)}</div>
              </div>
            </div>

            {/* Shift cards */}
            <div className="reports-shift-list">
              {reportShifts.length === 0 && (
                <div className="report-row empty">No shifts in this period</div>
              )}
              {reportShifts
                .slice()
                .sort((a, b) => b.date.localeCompare(a.date) || b.start.localeCompare(a.start))
                .map((shift) => {
                  const workedMinutes = minutesBetween(shift.start, shift.end) - shift.lunchMinutes
                  const hours = Math.max(workedMinutes, 0) / 60
                  const salary = hours * shift.hourlyRate
                  return (
                    <article key={shift.id} className="shift-card">
                      <div className="shift-card__header">
                        <div className="shift-date">{formatShortDate(shift.date)}</div>
                        <div style={{ position: 'relative' }}>
                          <button
                            className="shift-menu-btn"
                            onClick={(e) => { e.stopPropagation(); setOpenMenuShiftId(openMenuShiftId === shift.id ? null : shift.id) }}
                          >
                            <MoreVertical size={16} />
                          </button>
                          {openMenuShiftId === shift.id && (
                            <div className="shift-context-menu">
                              <button className="shift-context-item" onClick={() => { openEdit(shift); setOpenMenuShiftId(null) }}>Edit</button>
                              <button className="shift-context-item danger" onClick={() => { handleDelete(shift.id); setOpenMenuShiftId(null) }}>Delete</button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="shift-info-row">
                        <div className="shift-icon-item">
                          <div className="shift-icon-badge clock"><Clock size={16} /></div>
                          {shift.start}–{shift.end}
                        </div>
                        <div className="shift-icon-item">
                          <div className="shift-icon-badge lunch"><Coffee size={16} /></div>
                          {formatLunch(shift.lunchMinutes)}
                        </div>
                        <div className="shift-icon-item">
                          <div className="shift-icon-badge money"><Banknote size={16} /></div>
                          <span className="shift-pay">${money(salary)}</span>
                        </div>
                      </div>
                      {shift.comment && <div className="comment">"{shift.comment}"</div>}
                    </article>
                  )
                })}
            </div>
          </section>
        ) : activeView === 'clients' ? (
          <section className="clients-section">
            <div className="modal-header" style={{ marginBottom: '12px' }}>
              <div className="modal-title">Clients</div>
              <button className="add-action-btn" onClick={openAddClient}>+ Add Client</button>
            </div>
            {clients.length === 0 ? (
              <div className="report-row empty">No clients yet. Add your first client.</div>
            ) : (
              clients.map(client => (
                <div key={client.id} className="shift-card" style={{ cursor: 'pointer' }} onClick={() => openEditClient(client)}>
                  <div className="shift-card__header">
                    <div>
                      <div className="shift-date">{client.name}</div>
                      {client.email && <div className="label" style={{ marginTop: 2 }}>{client.email}</div>}
                    </div>
                    <button
                      className="ghost-button danger"
                      onClick={e => { e.stopPropagation(); handleDeleteClient(client.id) }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </section>
        ) : (
          <>
            <section className="calendar-card">
              <div className="reports-header">
                <button className="nav-btn" onClick={goPrevCalendarMonth}><ChevronLeft size={16} /></button>
                <div className="reports-range">{calendarMonthLabel}</div>
                <button className="nav-btn" onClick={goNextCalendarMonth}><ChevronRight size={16} /></button>
              </div>

              <div className="calendar-weekdays">
                {calendarWeekLabels.map((label) => (
                  <div key={label} className="calendar-weekday">{label}</div>
                ))}
              </div>

              <div className="calendar-grid">
                {calendarCells.map((cell, idx) => {
                  if (!cell.date || !cell.day) {
                    return <div key={`blank-${idx}`} className="calendar-day-empty" />
                  }
                  const dateKey = cell.date
                  const hasShifts = shiftsByDate.has(dateKey)
                  const isSelected = dateKey === calendarSelectedDate
                  const isToday = dateKey === todayIso
                  return (
                    <button
                      key={dateKey}
                      type="button"
                      className={`calendar-day${isSelected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}${hasShifts ? ' has-shifts' : ''}`}
                      onClick={() => setCalendarSelectedDate(dateKey)}
                    >
                      <span className="calendar-day-number">{cell.day}</span>
                      {hasShifts && <span className="calendar-day-dot" />}
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="shift-list">
              <div className="calendar-selected-label">Shifts on {formatDate(calendarSelectedDate)}</div>
              {selectedDayShifts.length > 0 ? (
                selectedDayShifts.map((shift) => {
                  const workedMinutes = minutesBetween(shift.start, shift.end) - shift.lunchMinutes
                  const hours = Math.max(workedMinutes, 0) / 60
                  const salary = hours * shift.hourlyRate
                  return (
                    <article key={shift.id} className="shift-card">
                      <div className="shift-card__header">
                        <div className="shift-date">{formatShortDate(shift.date)}</div>
                        <div style={{ position: 'relative' }}>
                          <button
                            className="shift-menu-btn"
                            onClick={(e) => { e.stopPropagation(); setOpenMenuShiftId(openMenuShiftId === shift.id ? null : shift.id) }}
                          >
                            <MoreVertical size={16} />
                          </button>
                          {openMenuShiftId === shift.id && (
                            <div className="shift-context-menu">
                              <button className="shift-context-item" onClick={() => { openEdit(shift); setOpenMenuShiftId(null) }}>Edit</button>
                              <button className="shift-context-item danger" onClick={() => { handleDelete(shift.id); setOpenMenuShiftId(null) }}>Delete</button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="shift-info-row">
                        <div className="shift-icon-item">
                          <div className="shift-icon-badge clock"><Clock size={16} /></div>
                          {shift.start}–{shift.end}
                        </div>
                        <div className="shift-icon-item">
                          <div className="shift-icon-badge lunch"><Coffee size={16} /></div>
                          {formatLunch(shift.lunchMinutes)}
                        </div>
                        <div className="shift-icon-item">
                          <div className="shift-icon-badge money"><Banknote size={16} /></div>
                          <span className="shift-pay">${money(salary)}</span>
                        </div>
                      </div>
                      {shift.comment && <div className="comment">"{shift.comment}"</div>}
                    </article>
                  )
                })
              ) : (
                <div className="report-row empty">No shifts for this day</div>
              )}
            </section>
          </>
        )}
      </main>

      {/* FAB (circular, expandable) */}
      {activeView === 'reports' || activeView === 'calendar' || activeView === 'clients' ? (
        <button className="floating-btn" onClick={goHome}>
          <Home size={24} />
        </button>
      ) : activeView === 'home' && (
        <>
          {isFabOpen && <div className="fab-backdrop" onClick={() => { setIsFabOpen(false); setFabInvoiceOpen(false) }} />}
          {isFabOpen && (
            <div className="fab-menu">
              {fabInvoiceOpen ? (
                <>
                  <button className="fab-menu-item" onClick={openInvoiceByTime}>
                    <Clock size={20} />
                    Invoice by Time
                  </button>
                  <button className="fab-menu-item" onClick={openInvoiceByServices}>
                    <Wrench size={20} />
                    Invoice by Services
                  </button>
                </>
              ) : (
                <>
                  <button className="fab-menu-item" onClick={() => setFabInvoiceOpen(true)}>
                    <FileText size={20} />
                    Create Invoice
                  </button>
                  <button className="fab-menu-item" onClick={() => { setIsFabOpen(false); openCreate() }}>
                    <Clock size={20} />
                    New Shift
                  </button>
                  <button className="fab-menu-item" onClick={() => { setIsFabOpen(false); openReports() }}>
                    <BarChart2 size={20} />
                    Reports
                  </button>
                </>
              )}
            </div>
          )}
          <button className="floating-btn" onClick={() => { setIsFabOpen(prev => !prev); setFabInvoiceOpen(false) }}>
            {isFabOpen ? <X size={24} /> : <Plus size={24} />}
          </button>
        </>
      )}

      {/* SHIFT FORM MODAL */}
      {isAddOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-dark">
              <div className="modal-title-dark">{editingId ? 'Edit shift' : 'New shift'}</div>
              <button className="modal-close-btn" onClick={closeModal}><X size={18} /></button>
            </div>

            <div className="form-grid">
              {/* Date */}
              <div className="field">
                <span className="label">Date</span>
                <button
                  type="button"
                  className="form-field-btn"
                  onClick={() => setActivePickerField(activePickerField === 'date' ? null : 'date')}
                >
                  {formatDate(form.date)}
                </button>
                {activePickerField === 'date' && (
                  <div className="form-calendar">
                    <div className="form-calendar-header">
                      <button type="button" className="nav-btn" onClick={() => setFormCalendarMonth(prev => shiftMonthKey(prev, -1))}><ChevronLeft size={16} /></button>
                      <span className="form-calendar-title">{formCalendarLabel}</span>
                      <button type="button" className="nav-btn" onClick={() => setFormCalendarMonth(prev => shiftMonthKey(prev, 1))}><ChevronRight size={16} /></button>
                    </div>
                    <div className="calendar-weekdays">
                      {calendarWeekLabels.map(l => <div key={l} className="calendar-weekday">{l}</div>)}
                    </div>
                    <div className="calendar-grid">
                      {formCalendarCells.map((cell, idx) => {
                        if (!cell.date || !cell.day) return <div key={`fb-${idx}`} className="calendar-day-empty" />
                        const isSelected = cell.date === form.date
                        const isToday = cell.date === todayIso
                        return (
                          <button
                            key={cell.date}
                            type="button"
                            className={`calendar-day${isSelected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}`}
                            onClick={() => {
                              setForm(prev => ({ ...prev, date: cell.date! }))
                              setActivePickerField(null)
                            }}
                          >
                            <span className="calendar-day-number">{cell.day}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Client */}
              {clients.length > 0 && (
                <div className="field">
                  <span className="label">Client</span>
                  <select
                    value={form.clientId ?? ''}
                    onChange={e => setForm(prev => ({ ...prev, clientId: e.target.value ? Number(e.target.value) : null }))}
                  >
                    {clients.length !== 1 && <option value="">Select Client</option>}
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              {/* Start */}
              <div className="field">
                <span className="label">Start</span>
                <button
                  type="button"
                  className="form-field-btn"
                  onClick={() => setActivePickerField(activePickerField === 'start' ? null : 'start')}
                >
                  {form.start}
                </button>
              </div>

              {/* End */}
              <div className="field">
                <span className="label">End</span>
                <button
                  type="button"
                  className="form-field-btn"
                  onClick={() => setActivePickerField(activePickerField === 'end' ? null : 'end')}
                >
                  {form.end}
                </button>
              </div>

              {/* Lunch */}
              <div className="field">
                <span className="label">Lunch</span>
                <button
                  type="button"
                  className="form-field-btn"
                  onClick={() => setActivePickerField(activePickerField === 'lunch' ? null : 'lunch')}
                >
                  {formatLunch(form.lunchMinutes)}
                </button>
              </div>

              {/* Comment */}
              <label className="field">
                <span className="label">Comment</span>
                <textarea
                  rows={3}
                  value={form.comment}
                  onChange={(e) => setForm((prev) => ({ ...prev, comment: e.target.value }))}
                />
              </label>
            </div>

            <button className="primary-btn" onClick={handleSave} disabled={form.clientId === null}>Save</button>
          </div>
        </div>
      )}

      {/* TIME PICKER BOTTOM SHEET */}
      {(activePickerField === 'start' || activePickerField === 'end') && (
        <>
          <div className="picker-sheet-backdrop" onClick={() => setActivePickerField(null)} />
          <div className="picker-sheet">
            <div className="picker-sheet-title">{activePickerField === 'start' ? 'Start Time' : 'End Time'}</div>
            <div className="picker-display">
              <div className="picker-display-label">Selected</div>
              <div className="picker-display-value">
                {activePickerField === 'start' ? form.start : form.end}
              </div>
            </div>
            <div className="picker-cols">
              <div>
                <div className="picker-col-label">
                  <span className="picker-col-title">Hour</span>
                </div>
                <WheelPicker
                  options={hourOptions}
                  value={(activePickerField === 'start' ? form.start : form.end).split(':')[0]}
                  onChange={(val) => updateTime(activePickerField as 'start' | 'end', 'hour', val)}
                />
              </div>
              <div>
                <div className="picker-col-label">
                  <span className="picker-col-title">Minute</span>
                </div>
                <WheelPicker
                  options={minuteOptions}
                  value={(activePickerField === 'start' ? form.start : form.end).split(':')[1]}
                  onChange={(val) => updateTime(activePickerField as 'start' | 'end', 'minute', val)}
                />
              </div>
            </div>
            <div className="actions-row">
              <button className="ghost-button" onClick={() => setActivePickerField(null)}>Cancel</button>
              <button className="primary-btn" onClick={() => setActivePickerField(null)}>Done</button>
            </div>
          </div>
        </>
      )}

      {/* LUNCH PICKER BOTTOM SHEET */}
      {activePickerField === 'lunch' && (
        <>
          <div className="picker-sheet-backdrop" onClick={() => setActivePickerField(null)} />
          <div className="picker-sheet">
            <div className="picker-sheet-title">Lunch Break</div>
            <div className="picker-display">
              <div className="picker-display-label">Selected</div>
              <div className="picker-display-value">{formatLunch(form.lunchMinutes)}</div>
            </div>
            <div className="picker-row single">
              <WheelPicker
                options={lunchOptions}
                value={String(form.lunchMinutes)}
                onChange={(val) => setForm(prev => ({ ...prev, lunchMinutes: Number(val) }))}
              />
            </div>
            <div className="actions-row">
              <button className="ghost-button" onClick={() => setActivePickerField(null)}>Cancel</button>
              <button className="primary-btn" onClick={() => setActivePickerField(null)}>Done</button>
            </div>
          </div>
        </>
      )}

      {/* CLIENT MODAL */}
      {isClientModalOpen && (
        <div className="modal-backdrop" onClick={closeClientModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header-dark">
              <div className="modal-title-dark">{editingClientId !== null ? 'Edit Client' : 'Add Client'}</div>
              <button className="modal-close-btn" onClick={closeClientModal}><X size={18} /></button>
            </div>
            <div className="form-grid" style={{ marginTop: '12px' }}>
              <label className="field">
                <span className="label">Full Name / Company Name</span>
                <input
                  className="input"
                  type="text"
                  value={clientDraft.name}
                  onChange={e => setClientDraft(prev => ({ ...prev, name: e.target.value }))}
                  autoFocus
                />
              </label>
              <label className="field">
                <span className="label">Address</span>
                <input
                  className="input"
                  type="text"
                  value={clientDraft.address}
                  onChange={e => setClientDraft(prev => ({ ...prev, address: e.target.value }))}
                />
              </label>
              <label className="field">
                <span className="label">ABN</span>
                <input
                  className="input"
                  type="text"
                  value={clientDraft.abn}
                  onChange={e => setClientDraft(prev => ({ ...prev, abn: e.target.value }))}
                />
              </label>
              <label className="field">
                <span className="label">Email</span>
                <input
                  className="input"
                  type="email"
                  value={clientDraft.email}
                  onChange={e => setClientDraft(prev => ({ ...prev, email: e.target.value }))}
                />
              </label>
            </div>
            <button className="primary-btn" style={{ marginTop: '16px' }} onClick={saveClient}>Save</button>
          </div>
        </div>
      )}

      {/* UPGRADE MODAL */}
      {isUpgradeModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsUpgradeModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header-dark">
              <div className="modal-title-dark">Upgrade to Pro</div>
              <button className="modal-close-btn" onClick={() => setIsUpgradeModalOpen(false)}><X size={18} /></button>
            </div>
            <div style={{ padding: '8px 0 4px', textAlign: 'center' }}>
              <p style={{ marginBottom: '6px' }}>Your current plan allows only <strong>1 client</strong>.</p>
              <p style={{ marginBottom: '24px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                Upgrade to Pro to add unlimited clients.
              </p>
              <button
                className="primary-btn"
                onClick={() => { setIsUpgradeModalOpen(false); navigate('/app/billing') }}
              >
                Upgrade to Pro →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {isSettingsOpen && (
        <div className="modal-backdrop" onClick={closeSettings}>
          <div className="modal modal-pinned" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-dark">
              <div className="modal-title-dark">Settings</div>
              <button className="modal-close-btn" onClick={closeSettings}><X size={18} /></button>
            </div>

            <div className="form-grid">
              <div className="field">
                <span className="label">Reporting period</span>
                <div className="segment">
                  {[
                    { value: 'weekly', label: 'Weekly' },
                    { value: 'monthly', label: 'Monthly' },
                    { value: 'custom', label: 'Custom dates' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      className={`segment-btn ${settingsDraft.period === opt.value ? 'is-active' : ''}`}
                      onClick={() => setSettingsDraft((prev) => ({ ...prev, period: opt.value as Settings['period'] }))}
                      type="button"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {settingsDraft.period === 'weekly' && (
                <div className="field">
                  <span className="label">Week starts on</span>
                  <div className="segment">
                    {[
                      'monday',
                      'tuesday',
                      'wednesday',
                      'thursday',
                      'friday',
                      'saturday',
                      'sunday',
                    ].map((day) => (
                      <button
                        key={day}
                        className={`segment-btn compact ${settingsDraft.weekStart === day ? 'is-active' : ''}`}
                        onClick={() =>
                          setSettingsDraft((prev) => ({ ...prev, weekStart: day as Settings['weekStart'] }))
                        }
                        type="button"
                      >
                        {day === 'monday'
                          ? 'Mon'
                          : day === 'tuesday'
                            ? 'Tue'
                            : day === 'wednesday'
                              ? 'Wed'
                              : day === 'thursday'
                                ? 'Thu'
                                : day === 'friday'
                                  ? 'Fri'
                                  : day === 'saturday'
                                    ? 'Sat'
                                    : 'Sun'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <label className="field">
                <span className="label">Weekday rate (AUD)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*[.,]?[0-9]*"
                  value={hourlyRateInput}
                  onChange={(e) => {
                    const raw = e.target.value
                    setHourlyRateInput(raw)
                    const parsed = parseDecimal(raw)
                    if (parsed !== null) {
                      setSettingsDraft((prev) => ({ ...prev, hourlyRate: Math.max(0, parsed) }))
                    }
                  }}
                />
              </label>

              <div className="field">
                <div className="toggle-row">
                  <span className="label">Different rate for weekends</span>
                  <button
                    type="button"
                    className={`toggle-btn ${settingsDraft.weekendRateEnabled ? 'is-on' : ''}`}
                    onClick={() => setSettingsDraft(prev => ({ ...prev, weekendRateEnabled: !prev.weekendRateEnabled }))}
                  >
                    <span className="toggle-knob" />
                  </button>
                </div>
              </div>

              {settingsDraft.weekendRateEnabled && (
                <label className="field">
                  <span className="label">Weekend rate (AUD)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*[.,]?[0-9]*"
                    value={weekendRateInput}
                    onChange={(e) => {
                      const raw = e.target.value
                      setWeekendRateInput(raw)
                      const parsed = parseDecimal(raw)
                      if (parsed !== null) {
                        setSettingsDraft((prev) => ({ ...prev, weekendRate: Math.max(0, parsed) }))
                      }
                    }}
                  />
                </label>
              )}
            </div>

            <button className="primary-btn" onClick={saveSettings}>Save</button>
          </div>
        </div>
      )}

      {/* INVOICE DETAILS MODAL */}
      {isInvoiceModalOpen && (
        <div className="modal-backdrop" onClick={closeInvoiceModal}>
          <div className="modal modal-pinned" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-dark">
              <div className="modal-title-dark">Invoice details</div>
              <button className="modal-close-btn" onClick={closeInvoiceModal}><X size={18} /></button>
            </div>

            <div className="form-grid">
              <label className="field">
                <span className="label">Full Name</span>
                <input
                  type="text"
                  value={invoiceDraft.fullName}
                  onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, fullName: e.target.value }))}
                />
              </label>

              <label className="field">
                <span className="label">Address</span>
                <input
                  type="text"
                  value={invoiceDraft.address}
                  onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, address: e.target.value }))}
                />
              </label>

              <label className="field">
                <span className="label">ABN</span>
                <input
                  type="text"
                  value={invoiceDraft.abn}
                  onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, abn: e.target.value }))}
                />
              </label>

              <label className="field">
                <span className="label">Speciality</span>
                <input
                  type="text"
                  value={invoiceDraft.speciality}
                  onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, speciality: e.target.value }))}
                />
              </label>

              <label className="field">
                <span className="label">Account Bank Name</span>
                <input
                  type="text"
                  value={invoiceDraft.accountBankName}
                  onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, accountBankName: e.target.value }))}
                />
              </label>

              <label className="field">
                <span className="label">BSB</span>
                <input
                  type="text"
                  value={invoiceDraft.bsb}
                  onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, bsb: e.target.value }))}
                />
              </label>

              <label className="field">
                <span className="label">Account number</span>
                <input
                  type="text"
                  value={invoiceDraft.accountNumber}
                  onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, accountNumber: e.target.value }))}
                />
              </label>

              <label className="field">
                <span className="label">Next invoice number</span>
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*"
                  value={nextInvoiceNumberInput}
                  onChange={(e) => {
                    const raw = e.target.value
                    setNextInvoiceNumberInput(raw)
                    const parsed = parseDecimal(raw)
                    if (parsed !== null) {
                      setInvoiceDraft((prev) => ({
                        ...prev,
                        nextInvoiceNumber: Math.max(1, Math.round(parsed)),
                      }))
                    }
                  }}
                  onBlur={(e) => {
                    const parsed = parseDecimal(e.target.value)
                    const safe = Math.max(1, parsed ?? invoiceDraft.nextInvoiceNumber ?? 1)
                    setNextInvoiceNumberInput(String(Math.round(safe)))
                    setInvoiceDraft((prev) => ({ ...prev, nextInvoiceNumber: Math.round(safe) }))
                  }}
                />
              </label>

              <label className="field checkbox-inline">
                <span className="label">Include GST (10%)</span>
                <input
                  type="checkbox"
                  checked={invoiceDraft.chargeGst}
                  onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, chargeGst: e.target.checked }))}
                />
              </label>
            </div>

            <button className="primary-btn" onClick={saveInvoiceProfile}>Save</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App

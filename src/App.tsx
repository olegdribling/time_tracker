// ─────────────────────────────────────────────────────────────────────────────
// ИМПОРТЫ
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './App.css'
import {
  Banknote,    // иконка для биллинга/подписки
  BarChart2,   // иконка для отчётов
  ChevronLeft,
  ChevronRight,
  Clock,       // иконка для смен
  Coffee,      // иконка для перерыва на обед
  FileText,    // иконка для инвойса
  Home,        // иконка "домой"
  LogOut,      // иконка выхода
  MoreVertical,// иконка "три точки" (контекстное меню)
  Package,     // иконка продуктов
  Plus,        // иконка добавления (FAB-кнопка)
  Settings as SettingsIcon,
  Timer,
  User,
  Users,       // иконка клиентов
  X,           // иконка закрытия
} from 'lucide-react'
import { api } from './api'                                                       // REST-клиент (все запросы к серверу)
import { CreateInvoiceModal, calcLineItemAmount } from './components/CreateInvoiceModal' // модалка создания инвойса
import type { InvBTForm, InvSuccessData } from './components/CreateInvoiceModal'
import { useProducts } from './hooks/useProducts'                                  // хук управления продуктами
import { useSettings } from './hooks/useSettings'                                  // хук управления настройками
import { calculateTotals, getPeriodByOffset, getPeriodRange, minutesBetween } from './lib/calculations' // расчёты периодов и итогов
import { DEFAULT_INVOICE_PROFILE, DEFAULT_SETTINGS } from './lib/defaults'         // дефолтные значения
import { formatDate, money } from './lib/format'                                   // форматирование дат и денег
import { generateInvoicePdf } from './lib/invoice'                                 // генерация PDF инвойса
import type { Client, ClientDraft, InvoiceLineItem, InvoiceProfile, Settings, Shift, ShiftForm } from './types' // все TypeScript-типы

// ─────────────────────────────────────────────────────────────────────────────
// КОНСТАНТЫ
// ─────────────────────────────────────────────────────────────────────────────
const CLOCK_INTERVAL_MS = 30_000                 // как часто обновляются часы в хедере (30 сек)
const WEEK_MS = 7 * 24 * 60 * 60 * 1000         // миллисекунд в неделе (для группировки смен по неделям)

// Создаёт пустую форму новой смены с дефолтными значениями
const emptyForm = (): ShiftForm => {
  const date = toLocalDateKey(new Date())
  return {
    date,
    start: '07:00',
    end: '17:00',
    lunchMinutes: 30,
    comment: '',
    clientId: null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ФОРМАТИРОВАНИЯ
// ─────────────────────────────────────────────────────────────────────────────

// Форматирует дату для карточки смены: "Today", "Yesterday" или "15 April 2026"
function formatShortDate(value: string) {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00`)
  if (isNaN(date.getTime())) return value
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

// Форматирует обед в человекочитаемый вид: "No lunch", "30 min", "1 hour"
function formatLunch(minutes: number) {
  if (minutes === 0) return 'No lunch'
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (m === 0) return `${h} hour${h > 1 ? 's' : ''}`
  return `${h}h ${m}m`
}

// Форматирует длительность: минуты всегда двузначные: "7h 05m", "0h 45m", "8h 00m"
function formatDurationPadded(minutes: number) {
  const safe = Math.max(minutes, 0)
  const hours = Math.floor(safe / 60)
  const mins = safe % 60
  return `${hours}h ${String(mins).padStart(2, '0')}m`
}

// Парсит строку с числом, заменяя запятую на точку. Возвращает null если не число
const parseDecimal = (raw: string) => {
  const normalized = raw.replace(',', '.').trim()
  if (normalized === '') return null
  const num = Number(normalized)
  return Number.isFinite(num) ? num : null
}

// ─────────────────────────────────────────────────────────────────────────────
// ТИПЫ И КОНСТАНТЫ ДЛЯ CALENDAR / WEEKPICKER
// ─────────────────────────────────────────────────────────────────────────────

// Тип для опции в WheelPicker (барабанный выбор времени)
type Option = {
  value: string
  label: string
}

// Все дни недели в порядке JS (0=воскресенье)
const WEEKDAYS: Settings['weekStart'][] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]

// Короткие названия дней для отображения в заголовке календаря
const WEEKDAY_LABELS: Record<Settings['weekStart'], string> = {
  sunday: 'Sun',
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
}

// Календарь всегда начинается с понедельника (независимо от настройки недели пользователя)
const CALENDAR_WEEK_START: Settings['weekStart'] = 'monday'
const CALENDAR_WEEK_START_INDEX = WEEKDAYS.indexOf(CALENDAR_WEEK_START) // = 1

// Дополняет число до двух цифр: 5 → "05"
const pad2 = (value: number) => String(value).padStart(2, '0')

// Преобразует Date в строку "YYYY-MM-DD" по локальному времени (не UTC!)
const toLocalDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`

// Преобразует Date в строку "YYYY-MM" (ключ месяца для календаря)
const toMonthKey = (date: Date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`

// Разбирает строку "YYYY-MM" обратно в { year, month }
const parseMonthKey = (value: string) => {
  const [yearRaw, monthRaw] = value.split('-')
  return {
    year: Number(yearRaw),
    month: Number(monthRaw),
  }
}

// Сдвигает месяц на offset месяцев вперёд/назад, возвращает новый ключ "YYYY-MM"
const shiftMonthKey = (value: string, offset: number) => {
  const { year, month } = parseMonthKey(value)
  const shifted = new Date(year, month - 1 + offset, 1)
  return toMonthKey(shifted)
}


// ─────────────────────────────────────────────────────────────────────────────
// КОМПОНЕНТ: WheelPicker — барабанный выбор времени (часы/минуты/обед)
// ─────────────────────────────────────────────────────────────────────────────
type WheelPickerProps = {
  options: Option[]       // список значений (напр. 00..23 для часов)
  value: string           // текущее выбранное значение
  onChange: (value: string) => void
  itemHeight?: number     // высота одной строки в пикселях (по умолчанию 44)
}

const WheelPicker = ({ options, value, onChange, itemHeight = 44 }: WheelPickerProps) => {
  const ref = useRef<HTMLDivElement | null>(null)
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const viewportPadding = itemHeight
  const wheelHeight = itemHeight * 3  // показываем 3 строки (одна по центру — выбранная)
  // Список троится для эффекта "бесконечного" барабана
  const loopedOptions = useMemo(() => [...options, ...options, ...options], [options])
  const baseCount = options.length
  const middleOffset = baseCount // начинаем с середины троированного списка

  // При смене value — плавно скроллим к нужной позиции
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

  // Привязывает скролл к ближайшему значению после остановки (snap-эффект)
  const snapToNearest = () => {
    if (!ref.current || !baseCount) return
    const { scrollTop } = ref.current
    const relative = scrollTop - (viewportPadding - itemHeight)
    const index = Math.round(relative / itemHeight)
    const normalized = ((index % baseCount) + baseCount) % baseCount
    const targetIndex = middleOffset + normalized
    const target = Math.max(0, viewportPadding - itemHeight + targetIndex * itemHeight)
    // Прыгаем в середину только если нужен "сброс" бесконечного цикла
    if (Math.abs(scrollTop - target) > 2) {
      ref.current.scrollTo({ top: target, behavior: 'instant' })
    }
    const selected = options[normalized]
    if (selected && selected.value !== value) {
      onChange(selected.value)
    }
  }

  // Ждёт 80мс после последнего события скролла, потом фиксирует позицию
  const handleScroll = () => {
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current)
    scrollTimeout.current = setTimeout(snapToNearest, 80)
  }

  return (
    <div className="wheel" style={{ height: wheelHeight }}>
      <div className="wheel__mask" />    {/* затемнение сверху и снизу */}
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
      <div className="wheel__highlight" style={{ height: itemHeight }} />  {/* подсветка центральной строки */}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ФУНКЦИЯ: buildCalendarCells — строит сетку дней для отображения календаря
// Возвращает массив ячеек (всегда кратен 7 — полные недели).
// Ячейки без даты (до начала и после конца месяца) имеют date=null, day=null.
// ─────────────────────────────────────────────────────────────────────────────
function buildCalendarCells(monthKey: string): Array<{ date: string | null; day: number | null }> {
  const { year, month } = parseMonthKey(monthKey)
  const firstDay = new Date(year, month - 1, 1).getDay()            // день недели первого числа (0=вс)
  const daysInMonth = new Date(year, month, 0).getDate()             // сколько дней в месяце
  const leadingBlanks = (firstDay - CALENDAR_WEEK_START_INDEX + 7) % 7 // пустых ячеек в начале (перед 1-м числом)
  const totalCells = Math.ceil((leadingBlanks + daysInMonth) / 7) * 7  // всего ячеек (полные недели)
  const monthPrefix = `${year}-${pad2(month)}`
  const cells: Array<{ date: string | null; day: number | null }> = []
  for (let idx = 0; idx < totalCells; idx += 1) {
    const day = idx - leadingBlanks + 1
    if (day < 1 || day > daysInMonth) {
      cells.push({ date: null, day: null })          // пустая ячейка (до/после месяца)
    } else {
      cells.push({ date: `${monthPrefix}-${pad2(day)}`, day }) // реальный день
    }
  }
  return cells
}

// ─────────────────────────────────────────────────────────────────────────────
// ГЛАВНЫЙ КОМПОНЕНТ ПРИЛОЖЕНИЯ
// ─────────────────────────────────────────────────────────────────────────────
function App() {
  const navigate = useNavigate()

  // ── Общее состояние ────────────────────────────────────────────────────────
  const [appReady, setAppReady] = useState(false)       // false пока данные не загружены с сервера → показываем сплэш
  const [shifts, setShifts] = useState<Shift[]>([])     // все смены пользователя
  const [isAddOpen, setIsAddOpen] = useState(false)     // открыта ли модалка "New shift / Edit shift"
  const [isMenuOpen, setIsMenuOpen] = useState(false) // при загрузке меню всегда закрыто

  // ── Invoice Details (профиль для инвойсов) ─────────────────────────────────
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false)
  const [invoiceProfile, setInvoiceProfile] = useState<InvoiceProfile>(DEFAULT_INVOICE_PROFILE) // сохранённые данные
  const [invoiceDraft, setInvoiceDraft] = useState<InvoiceProfile>(DEFAULT_INVOICE_PROFILE)     // черновик в форме (до Save)
  // Строковые инпуты для числовых полей (чтобы пользователь мог вводить "." без сброса)
  const [nextInvoiceNumberInput, setNextInvoiceNumberInput] = useState('1')
  const [hourlyRateInput, setHourlyRateInput] = useState(String(DEFAULT_INVOICE_PROFILE.hourlyRate))
  const [weekendRateInput, setWeekendRateInput] = useState(String(DEFAULT_INVOICE_PROFILE.weekendRate))

  // ── Защита от гонки запросов ───────────────────────────────────────────────
  // isMutatingRef=true пока выполняется создание/обновление/удаление → syncData пропускает перезагрузку
  const isMutatingRef = useRef(false)

  // ── Пользователь и авторизация ────────────────────────────────────────────
  const [userEmail, setUserEmail] = useState<string>('')
  const [editingId, setEditingId] = useState<string | null>(null) // id смены при редактировании (null = новая)

  // ── Навигация между экранами ──────────────────────────────────────────────
  const [activeView, setActiveView] = useState<'home' | 'reports' | 'calendar' | 'clients' | 'products'>('home')

  // ── Клиенты ───────────────────────────────────────────────────────────────
  const [clients, setClients] = useState<Client[]>([])
  const [isClientModalOpen, setIsClientModalOpen] = useState(false)
  const [editingClientId, setEditingClientId] = useState<number | null>(null)
  const [clientDraft, setClientDraft] = useState<ClientDraft>({ name: '', address: '', abn: '', email: '' })
  // Откуда открыли "Add Client" — чтобы вернуться назад после сохранения
  const [clientReturnContext, setClientReturnContext] = useState<'invoiceByTime' | 'shiftForm' | null>(null)

  // ── Биллинг / подписка ────────────────────────────────────────────────────
  const [billingPlan, setBillingPlan] = useState<string>('trial')   // 'trial' | 'solo' | 'pro'
  const [billingActive, setBillingActive] = useState<boolean>(true)  // false если подписка истекла
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false) // попап "Upgrade plan"
  const [isExpiredModalOpen, setIsExpiredModalOpen] = useState(false) // попап "Trial expired"

  // Проверяет активность подписки; показывает попап и возвращает false если истекла
  const requireActive = (): boolean => {
    if (!billingActive) {
      setIsExpiredModalOpen(true)
      return false
    }
    return true
  }

  // ── Настройки (период, начало недели) — вынесены в хук useSettings ─────────
  const [periodOffset, setPeriodOffset] = useState(0) // смещение периода: 0=текущий, -1=предыдущий и т.д.

  const {
    settings, setSettings,         // сохранённые настройки
    settingsDraft, setSettingsDraft, // черновик в форме Settings (до Save)
    isSettingsOpen,                  // открыта ли модалка Settings
    openSettingsModal, closeSettings, saveSettings, // действия
  } = useSettings(setPeriodOffset)

  // ── Продукты — вынесены в хук useProducts ─────────────────────────────────
  const {
    products, setProducts,
    isProductModalOpen,
    editingProductId,
    productDraft, setProductDraft,
    openAddProduct, openEditProduct, closeProductModal, saveProduct, handleDeleteProduct,
  } = useProducts({ isMutatingRef, requireActive, billingPlan, setIsUpgradeModalOpen })

  // ── Главный экран: сколько групп недель показывать (кнопка "Load more") ────
  const [weeksVisible, setWeeksVisible] = useState(2)

  // ── Отчёты ────────────────────────────────────────────────────────────────
  const [reportClientId, setReportClientId] = useState<number | null>(null) // фильтр по клиенту в отчёте

  // ── Полноэкранный календарь ───────────────────────────────────────────────
  const [calendarMonth, setCalendarMonth] = useState(() => toMonthKey(new Date()))
  const [calendarSelectedDate, setCalendarSelectedDate] = useState(() => toLocalDateKey(new Date()))

  // ── Контекстное меню (три точки) на карточках ─────────────────────────────
  // Храним один объект { type, id } вместо трёх отдельных state
  const [openMenu, setOpenMenu] = useState<{ type: 'shift' | 'product' | 'client'; id: string | number } | null>(null)
  const openMenuShiftId   = openMenu?.type === 'shift'   ? openMenu.id as string : null
  const openMenuProductId = openMenu?.type === 'product' ? openMenu.id as number : null
  const openMenuClientId  = openMenu?.type === 'client'  ? openMenu.id as number : null
  const setOpenMenuShiftId   = (id: string | null) => setOpenMenu(id ? { type: 'shift',   id } : null)
  const setOpenMenuProductId = (id: number | null) => setOpenMenu(id ? { type: 'product', id } : null)
  const setOpenMenuClientId  = (id: number | null) => setOpenMenu(id ? { type: 'client',  id } : null)

  // ── FAB-кнопка (плавающая + кнопка) ──────────────────────────────────────
  const [isFabOpen, setIsFabOpen] = useState(false) // открыто ли FAB-меню

  // ── Модалка "Create Invoice" ──────────────────────────────────────────────
  const [isInvoiceByTimeOpen, setIsInvoiceByTimeOpen] = useState(false)
  const [invBTForm, setInvBTForm] = useState<InvBTForm>({  // форма инвойса (номер, дата, клиент, комментарий)
    number: '1',
    date: toLocalDateKey(new Date()),
    clientId: null,
    comments: '',
  })
  const [invBTCalendarOpen, setInvBTCalendarOpen] = useState(false)        // открыт ли встроенный календарь в форме
  const [invBTSuccessData, setInvBTSuccessData] = useState<InvSuccessData | null>(null) // данные для экрана "Invoice Created"
  const [invBTCalendarMonth, setInvBTCalendarMonth] = useState(() => toMonthKey(new Date()))
  const [invLineItems, setInvLineItems] = useState<InvoiceLineItem[]>([])   // строки инвойса (time/service/product)
  const [invAddMenuOpen, setInvAddMenuOpen] = useState(false)               // открыто ли меню "+ Add Item"

  // ── Форма смены ───────────────────────────────────────────────────────────
  const [form, setForm] = useState<ShiftForm>(emptyForm)                                                      // данные формы (дата, время, обед, комментарий, клиент)
  const [activePickerField, setActivePickerField] = useState<'date' | 'start' | 'end' | 'lunch' | null>(null) // какой барабанный пикер открыт
  const [formCalendarMonth, setFormCalendarMonth] = useState(() => toMonthKey(new Date()))                    // месяц в мини-календаре формы

  // ── Settings: календари для кастомного периода отчёта ─────────────────────
  const [settingsFromCalOpen, setSettingsFromCalOpen] = useState(false)
  const [settingsToCalOpen, setSettingsToCalOpen] = useState(false)
  const [settingsFromCalMonth, setSettingsFromCalMonth] = useState(() => toMonthKey(new Date()))
  const [settingsToCalMonth, setSettingsToCalMonth] = useState(() => toMonthKey(new Date()))
  // Выбранные даты кастомного отчёта (НЕ сохраняются, только для разового отчёта)
  const [customReportFrom, setCustomReportFrom] = useState(() => toLocalDateKey(new Date()))
  const [customReportTo, setCustomReportTo] = useState(() => toLocalDateKey(new Date()))
  // Если не null — перекрывает обычный reportRange (используется при кастомном отчёте)
  const [customReportRange, setCustomReportRange] = useState<{ start: string; end: string } | null>(null)

  // ── Часы в хедере ─────────────────────────────────────────────────────────
  const [clockDisplay, setClockDisplay] = useState(() => {
    const now = new Date()
    return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`
  })

  // ── useEffect: начальная загрузка данных ──────────────────────────────────
  // Запускается один раз при монтировании компонента.
  // Параллельно получает все данные с сервера: смены, настройки, профиль инвойса,
  // текущего пользователя, клиентов, статус подписки, продукты.
  // Используем Promise.allSettled — один упавший запрос не ломает остальные.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [shiftsRes, settingsRes, invoiceRes, meRes, clientsRes, billingRes, productsRes] = await Promise.allSettled([
        api.getShifts(),
        api.getSettings(),
        api.getInvoiceProfile(),
        api.me(),
        api.getClients(),
        api.getBillingStatus(),
        api.getProducts(),
      ])

      if (cancelled) return

      const shiftRows   = shiftsRes.status   === 'fulfilled' && Array.isArray(shiftsRes.value)   ? shiftsRes.value   : []
      const settingsRow = settingsRes.status === 'fulfilled' ? settingsRes.value : null
      const invoiceRow  = invoiceRes.status  === 'fulfilled' ? invoiceRes.value  : null
      const meRow       = meRes.status       === 'fulfilled' ? meRes.value       : null
      const clientRows  = clientsRes.status  === 'fulfilled' && Array.isArray(clientsRes.value) ? clientsRes.value : []
      const billingRow  = billingRes.status  === 'fulfilled' ? billingRes.value  : null
      const productRows = productsRes.status === 'fulfilled' && Array.isArray(productsRes.value) ? productsRes.value : []

      if (meRow?.email) setUserEmail(meRow.email)

      try {
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
          const profile = { ...DEFAULT_INVOICE_PROFILE, ...invoiceRow }
          setInvoiceProfile(profile)
          setInvoiceDraft(profile)
        } else {
          setInvoiceProfile(DEFAULT_INVOICE_PROFILE)
          setInvoiceDraft(DEFAULT_INVOICE_PROFILE)
          await api.saveInvoiceProfile(DEFAULT_INVOICE_PROFILE)
        }

        setShifts(shiftRows)
        setClients(clientRows)
        setProducts(productRows)
        if (billingRow) {
          if (billingRow.plan) setBillingPlan(billingRow.plan)
          setBillingActive(billingRow.active)
        }
      } catch (error) {
        console.error('Failed to load data', error)
      }
      if (!cancelled) setAppReady(true)
    })()

    return () => {
      cancelled = true
    }
  }, [])

  // ── syncData: фоновая синхронизация с сервером ────────────────────────────
  // Перезагружает смены, клиентов и продукты. Вызывается при фокусе на вкладке
  // и при возврате страницы из фона (visibilitychange).
  // Если isMutatingRef=true (идёт мутация) — пропускаем, чтобы не перезаписать
  // оптимистичное обновление UI данными с сервера.
  const syncData = useCallback(async () => {
    if (isMutatingRef.current) return
    const [shiftsRes, clientsRes, productsRes] = await Promise.allSettled([
      api.getShifts(),
      api.getClients(),
      api.getProducts(),
    ])
    if (isMutatingRef.current) return
    const shiftRows = shiftsRes.status === 'fulfilled' && Array.isArray(shiftsRes.value) ? shiftsRes.value : null
    const clientRows = clientsRes.status === 'fulfilled' && Array.isArray(clientsRes.value) ? clientsRes.value : null
    const productRows = productsRes.status === 'fulfilled' && Array.isArray(productsRes.value) ? productsRes.value : null
    if (shiftRows !== null) setShifts(shiftRows)
    if (clientRows !== null) setClients(clientRows)
    if (productRows !== null) setProducts(productRows)
  }, [])

  // Подписываемся на события фокуса окна и переключения вкладки → синхронизируем данные
  useEffect(() => {
    const onVisible = () => { if (!document.hidden) syncData() }
    const onFocus = () => syncData()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
    }
  }, [syncData])

  // Тикаем каждые 30 секунд — обновляем часы в хедере
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setClockDisplay(`${pad2(now.getHours())}:${pad2(now.getMinutes())}`)
    }
    const id = setInterval(tick, CLOCK_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  // Синхронизируем строковый инпут номера инвойса с числовым значением из draft
  useEffect(() => {
    setNextInvoiceNumberInput(String(invoiceDraft.nextInvoiceNumber))
  }, [invoiceDraft.nextInvoiceNumber])

  // ── useMemo: вычисляемые значения ─────────────────────────────────────────

  // Дата сегодня в формате "15 April 2026" — отображается под часами в хедере
  const todayLabel = useMemo(() => {
    const now = new Date()
    return new Intl.DateTimeFormat('en-AU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now)
  }, [])

  // Опции для барабанного пикера часов: "00".."23"
  const hourOptions = useMemo<Option[]>(
    () => Array.from({ length: 24 }, (_, i) => ({ value: String(i).padStart(2, '0'), label: String(i) })),
    [],
  )

  // Опции для барабанного пикера минут: "00", "05", "10".. "55" (шаг 5 минут)
  const minuteOptions = useMemo<Option[]>(
    () =>
      Array.from({ length: 12 }, (_, i) => i * 5).map((m) => ({
        value: String(m).padStart(2, '0'),
        label: String(m).padStart(2, '0'),
      })),
    [],
  )

  // Опции для барабанного пикера обеда: 0, 5, 10.. 120 минут
  const lunchOptions = useMemo<Option[]>(
    () =>
      Array.from({ length: 25 }, (_, i) => i * 5).map((m) => ({
        value: String(m),
        label: String(m),
      })),
    [],
  )

  // Обновляет часть времени (час или минуту) в форме смены
  const updateTime = (field: 'start' | 'end', part: 'hour' | 'minute', value: string) => {
    setForm((prev) => {
      const [h, m] = prev[field].split(':')
      const next = part === 'hour' ? `${value}:${m}` : `${h}:${value}`
      return { ...prev, [field]: next }
    })
  }

  // Смены, отсортированные по дате (убывание), внутри даты — по времени начала (убывание)
  const sortedShifts = useMemo(
    () =>
      [...shifts].sort((a, b) =>
        a.date === b.date ? b.start.localeCompare(a.start) : b.date.localeCompare(a.date),
      ),
    [shifts],
  )

  // Группирует смены по неделям для отображения на главном экране:
  // "This Week", "Last Week", "2 Weeks Ago" и т.д.
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
      const diffWeeks = Math.round(diffMs / WEEK_MS)
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

  // Ограничиваем показ групп на главном экране (кнопка "Load more" добавляет ещё)
  const visibleGroups = useMemo(
    () => shiftGroups.slice(0, weeksVisible),
    [shiftGroups, weeksVisible]
  )
  // Показывать ли кнопку "Load more"
  const hasMoreGroups = shiftGroups.length > weeksVisible

  // Диапазон текущего периода (текущей недели / месяца) — для карточки итогов на главном экране
  const periodRange = useMemo(() => getPeriodRange(settings), [settings])

  // Итоги за текущий период (главный экран: "This week: X hours, $Y")
  const totals = useMemo(
    () => calculateTotals(shifts, periodRange),
    [shifts, periodRange],
  )

  // Диапазон для экрана отчётов. Если активен кастомный отчёт — берём его,
  // иначе вычисляем по смещению periodOffset относительно текущего периода
  const reportRange = useMemo(
    () => customReportRange ?? getPeriodByOffset(settings, periodOffset),
    [settings, periodOffset, customReportRange],
  )

  // Смены, попавшие в диапазон отчёта, с фильтром по клиенту (если выбран)
  const reportShifts = useMemo(() => {
    const inRange = reportRange
      ? shifts.filter(s => s.date >= reportRange.start && s.date <= reportRange.end)
      : shifts
    return reportClientId !== null && clients.length > 1
      ? inRange.filter(s => s.clientId === reportClientId)
      : inRange
  }, [shifts, reportRange, reportClientId, clients.length])

  // Суммарные итоги по смен в отчётном периоде (часы + деньги)
  const reportTotals = useMemo(
    () => calculateTotals(reportShifts, null),
    [reportShifts],
  )

  // Суммарное время обеда за отчётный период (для строки "Lunch" в отчёте)
  const reportLunchMinutes = useMemo(
    () => reportShifts.reduce((sum, s) => sum + s.lunchMinutes, 0),
    [reportShifts],
  )

  // Суммарные минуты за текущий период (используется в карточке периода на главном)
  const totalDurationMinutes = totals.durationMinutes

  // Строка "13 Apr — 19 Apr 2026" для карточки периода на главном экране
  const periodLabel = useMemo(() => {
    if (!periodRange) return 'All time'
    return `${formatDate(periodRange.start)} — ${formatDate(periodRange.end)}`
  }, [periodRange])

  // Строка диапазона для заголовка отчёта (может быть один день или диапазон)
  const reportPeriodLabel = useMemo(() => {
    if (!reportRange) return 'All time'
    if (reportRange.start === reportRange.end) return formatDate(reportRange.start)
    return `${formatDate(reportRange.start)} — ${formatDate(reportRange.end)}`
  }, [reportRange])

  // Подписи дней недели для заголовка календарей: ["Mon","Tue"..."Sun"]
  const calendarWeekLabels = useMemo(() => {
    return Array.from({ length: 7 }, (_, idx) => WEEKDAY_LABELS[WEEKDAYS[(CALENDAR_WEEK_START_INDEX + idx) % 7]])
  }, [])

  // Заголовок месяца для полноэкранного календаря: "April 2026"
  const calendarMonthLabel = useMemo(() => {
    const { year, month } = parseMonthKey(calendarMonth)
    return new Intl.DateTimeFormat('en-AU', {
      month: 'long',
      year: 'numeric',
    }).format(new Date(year, month - 1, 1))
  }, [calendarMonth])

  // Ячейки сетки для каждого из пяти календарей в приложении:
  const calendarCells = useMemo(() => buildCalendarCells(calendarMonth), [calendarMonth])               // полноэкранный
  const formCalendarCells = useMemo(() => buildCalendarCells(formCalendarMonth), [formCalendarMonth])   // в форме смены
  const formCalendarLabel = useMemo(() => {
    const { year, month } = parseMonthKey(formCalendarMonth)
    return new Intl.DateTimeFormat('en-AU', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
  }, [formCalendarMonth])
  const invBTCalendarCells = useMemo(() => buildCalendarCells(invBTCalendarMonth), [invBTCalendarMonth]) // в Create Invoice
  const invBTCalendarLabel = useMemo(() => {
    const { year, month } = parseMonthKey(invBTCalendarMonth)
    return new Intl.DateTimeFormat('en-AU', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
  }, [invBTCalendarMonth])
  const settingsFromCalCells = useMemo(() => buildCalendarCells(settingsFromCalMonth), [settingsFromCalMonth]) // "Date from" в Settings
  const settingsFromCalLabel = useMemo(() => {
    const { year, month } = parseMonthKey(settingsFromCalMonth)
    return new Intl.DateTimeFormat('en-AU', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
  }, [settingsFromCalMonth])
  const settingsToCalCells = useMemo(() => buildCalendarCells(settingsToCalMonth), [settingsToCalMonth])   // "Date to" в Settings
  const settingsToCalLabel = useMemo(() => {
    const { year, month } = parseMonthKey(settingsToCalMonth)
    return new Intl.DateTimeFormat('en-AU', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
  }, [settingsToCalMonth])

  // Карта date → список смен (для полноэкранного календаря: точки на днях)
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

  // Смены выбранного дня в полноэкранном календаре (список внизу)
  const selectedDayShifts = useMemo(
    () => shiftsByDate.get(calendarSelectedDate) ?? [],
    [shiftsByDate, calendarSelectedDate],
  )

  // Сегодняшняя дата в формате "YYYY-MM-DD" (для подсветки "сегодня" в календарях)
  const todayIso = useMemo(() => toLocalDateKey(new Date()), [])

  // Если у пользователя ровно один клиент — автоматически выбираем его в формах
  const soloClientId = clients.length === 1 ? clients[0].id : null

  // ── Действия: навигация и управление оверлеями ────────────────────────────

  // Закрывает все модалки и боковое меню одновременно
  const closeOverlays = () => {
    setIsMenuOpen(false)
    closeSettings()
    setIsInvoiceModalOpen(false)
  }

  // Открывает форму создания новой смены (пустая форма с датой сегодня)
  const openCreate = () => {
    closeOverlays()
    setEditingId(null)
    const f = { ...emptyForm(), clientId: soloClientId }
    setForm(f)
    setFormCalendarMonth(f.date.slice(0, 7))
    setActivePickerField(null)
    setIsAddOpen(true)
  }

  // Открывает форму редактирования существующей смены
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

  // Закрывает форму смены и сбрасывает состояние редактирования
  const closeModal = () => {
    setIsAddOpen(false)
    setEditingId(null)
    setActivePickerField(null)
  }

  // Открывает модалку Settings; сбрасывает состояние кастомных дат к сегодня
  const openSettings = () => {
    closeOverlays()
    setSettingsFromCalOpen(false)
    setSettingsToCalOpen(false)
    setSettingsFromCalMonth(toMonthKey(new Date()))
    setSettingsToCalMonth(toMonthKey(new Date()))
    setCustomReportFrom(toLocalDateKey(new Date()))
    setCustomReportTo(toLocalDateKey(new Date()))
    openSettingsModal(settings)
  }

  // Переходит на экран отчётов; сбрасывает кастомный диапазон и offset
  const openReports = () => {
    closeOverlays()
    setCustomReportRange(null)
    setActiveView('reports')
    setPeriodOffset(0)
    setReportClientId(soloClientId)
  }

  // Переходит на экран клиентов
  const openClients = () => {
    closeOverlays()
    setActiveView('clients')
  }

  // Переходит на экран продуктов
  const openProducts = () => {
    closeOverlays()
    setActiveView('products')
  }

  // Открывает полноэкранный календарь, переходя к нужной дате
  const openCalendar = (targetDate?: string) => {
    closeOverlays()
    const nextDate = targetDate ?? calendarSelectedDate ?? toLocalDateKey(new Date())
    setCalendarSelectedDate(nextDate)
    setCalendarMonth(nextDate.slice(0, 7))
    setActiveView('calendar')
  }

  // Тоггл кнопки-даты в хедере: если уже на календаре — возвращает домой, иначе открывает
  const toggleCalendarFromHeader = () => {
    if (activeView === 'calendar') {
      goHome()
      return
    }
    openCalendar(todayIso)
  }

  // Листаем месяц назад в полноэкранном календаре
  const goPrevCalendarMonth = () => {
    setCalendarMonth((prev) => shiftMonthKey(prev, -1))
  }

  // Листаем месяц вперёд в полноэкранном календаре
  const goNextCalendarMonth = () => {
    setCalendarMonth((prev) => shiftMonthKey(prev, 1))
  }

  // Возвращает на главный экран (home)
  const goHome = () => {
    closeOverlays()
    setActiveView('home')
  }

  // ── Действия: клиенты ─────────────────────────────────────────────────────

  // Открывает форму добавления нового клиента (из меню).
  // Trial/Solo: лимит 1 клиент → показываем попап апгрейда.
  const openAddClient = () => {
    if (!requireActive()) return
    if ((billingPlan === 'trial' || billingPlan === 'solo') && clients.length >= 1) {
      setIsUpgradeModalOpen(true)
      return
    }
    setEditingClientId(null)
    setClientDraft({ name: '', address: '', abn: '', email: '' })
    setClientReturnContext(null)
    setIsClientModalOpen(true)
  }

  // Открывает форму добавления клиента из контекста инвойса или формы смены.
  // После сохранения клиента — возвращаемся обратно в соответствующую форму.
  const openAddClientFromInvoice = (context: 'invoiceByTime' | 'shiftForm') => {
    if (!requireActive()) return
    if ((billingPlan === 'trial' || billingPlan === 'solo') && clients.length >= 1) {
      setIsUpgradeModalOpen(true)
      return
    }
    setEditingClientId(null)
    setClientDraft({ name: '', address: '', abn: '', email: '' })
    setClientReturnContext(context)
    if (context === 'invoiceByTime') setIsInvoiceByTimeOpen(false)
    if (context === 'shiftForm') setIsAddOpen(false)
    setIsClientModalOpen(true)
  }

  // Открывает форму редактирования существующего клиента
  const openEditClient = (client: Client) => {
    if (!requireActive()) return
    setEditingClientId(client.id)
    setClientDraft({ name: client.name, address: client.address, abn: client.abn, email: client.email })
    setIsClientModalOpen(true)
  }

  // Закрывает модалку клиента без сохранения
  const closeClientModal = () => {
    setIsClientModalOpen(false)
    setEditingClientId(null)
  }

  // Сохраняет клиента (создаёт или обновляет).
  // После создания — если пришли из инвойса/формы смены, возвращаемся туда с выбранным клиентом
  const saveClient = async () => {
    if (!clientDraft.name.trim()) { alert('Client name is required.'); return }
    isMutatingRef.current = true
    try {
      let newClientId: number | null = null
      if (editingClientId !== null) {
        await api.updateClient(editingClientId, clientDraft)
      } else {
        const data = await api.createClient(clientDraft)
        newClientId = data.id
      }
      const fresh = await api.getClients()
      setClients(fresh)
      setIsClientModalOpen(false)
      if (newClientId !== null) {
        // возвращаемся в инвойс-модалку с выбранным клиентом
        if (clientReturnContext === 'invoiceByTime') {
          setInvBTForm(prev => ({ ...prev, clientId: newClientId! }))
          setIsInvoiceByTimeOpen(true)
        } else if (clientReturnContext === 'shiftForm') {
          setForm(prev => ({ ...prev, clientId: newClientId! }))
          setIsAddOpen(true)
        }
      }
      setClientReturnContext(null)
    } catch (error) {
      alert('Failed to save client. Please try again.')
      console.error('Failed to save client', error)
    } finally {
      isMutatingRef.current = false
    }
  }

  // Удаляет клиента после подтверждения
  const handleDeleteClient = async (id: number) => {
    const ok = window.confirm('Remove this client? This cannot be undone.')
    if (!ok) return
    isMutatingRef.current = true
    try {
      await api.deleteClient(id)
      setClients(prev => prev.filter(c => c.id !== id))
    } catch (error) {
      alert('Failed to delete client. Please try again.')
      console.error('Failed to delete client', error)
    } finally {
      isMutatingRef.current = false
    }
  }

  // ── Действия: навигация по периодам в отчёте ──────────────────────────────

  // Переключение на предыдущий период (неделю/месяц) в экране отчётов
  const goPrevPeriod = () => setPeriodOffset((prev) => prev - 1)

  // Переключение на следующий период в экране отчётов
  const goNextPeriod = () => setPeriodOffset((prev) => prev + 1)

  // ── Действия: авторизация ──────────────────────────────────────────────────

  // Выход из аккаунта: отзываем токены на сервере, редиректим на /login
  const handleLogout = async () => {
    setIsMenuOpen(false)
    await api.logout()
    navigate('/login')
  }

  // ── Действия: смены ───────────────────────────────────────────────────────

  // Удаляет смену после подтверждения; оптимистично убирает из UI
  const handleDelete = async (id: string) => {
    const ok = window.confirm('Delete this shift?')
    if (!ok) return
    isMutatingRef.current = true
    try {
      await api.deleteShift(id)
      setShifts(prev => prev.filter(s => s.id !== id))
    } catch (error) {
      alert('Failed to delete shift. Please try again.')
      console.error('Failed to delete shift', error)
    } finally {
      isMutatingRef.current = false
    }
  }

  // Сохраняет смену (создаёт или обновляет).
  // Оптимистичный UI: обновляем локально, потом синхронизируем с сервером.
  // При ошибке — откатываем состояние к previousShifts.
  // При создании новой смены: автоматически применяем weekendRate если включено.
  const handleSave = async () => {
    const workMinutes = minutesBetween(form.start, form.end) - form.lunchMinutes
    if (workMinutes < 0) {
      alert('End time must be after start time (minus lunch).')
      return
    }

    isMutatingRef.current = true
    const previousShifts = shifts
    try {
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
            hourlyRate: invoiceProfile.hourlyRate,
            clientId: form.clientId,
          }),
          date: form.date,
          start: form.start,
          end: form.end,
          lunchMinutes: form.lunchMinutes,
          comment: form.comment.trim(),
          clientId: form.clientId,
        }
        setShifts(prev => prev.map(s => s.id === editingId ? updated : s))
        closeModal()
        await api.updateShift(updated)
      } else {
        // Определяем ставку: weekday или weekend (суббота=6, воскресенье=0)
        const dayOfWeek = new Date(`${form.date}T00:00:00`).getDay()
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
        const rateToUse = invoiceProfile.weekendRateEnabled && isWeekend ? invoiceProfile.weekendRate : invoiceProfile.hourlyRate
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
        setShifts(prev => [...prev, newShift])
        closeModal()
        await api.createShift(newShift)
      }
    } catch (error) {
      setShifts(previousShifts) // откат оптимистичного обновления
      alert('Failed to save shift. Please try again.')
      console.error('Failed to save shift', error)
    } finally {
      isMutatingRef.current = false
    }
  }

  // ── Действия: My Invoice Details ──────────────────────────────────────────

  // Открывает модалку "My Invoice Details"; копирует сохранённый профиль в draft
  const openInvoiceModal = () => {
    closeOverlays()
    setInvoiceDraft(invoiceProfile)
    setNextInvoiceNumberInput(String(invoiceProfile.nextInvoiceNumber))
    setHourlyRateInput(String(invoiceProfile.hourlyRate))
    setWeekendRateInput(String(invoiceProfile.weekendRate))
    setIsInvoiceModalOpen(true)
  }

  // Закрывает модалку без сохранения
  const closeInvoiceModal = () => {
    setIsInvoiceModalOpen(false)
  }

  // Сохраняет профиль инвойса на сервер и в локальный state
  const saveInvoiceProfile = async () => {
    setInvoiceProfile(invoiceDraft)
    try {
      await api.saveInvoiceProfile(invoiceDraft)
    } catch (error) {
      console.error('Failed to save invoice profile', error)
    }
    closeInvoiceModal()
  }

  // Проверяет, заполнены ли минимальные поля профиля (имя + номер счёта)
  // Используется для решения показывать ли предупреждение в UI
  const hasInvoiceCoreFields = invoiceProfile.fullName.trim() !== '' && invoiceProfile.accountNumber.trim() !== ''

  // ── Действия: Create Invoice ──────────────────────────────────────────────

  // Добавляет новую строку в инвойс (time/service/product)
  // Для time — подставляет ставку из профиля и специальность как описание
  const addLineItem = (type: InvoiceLineItem['type']) => {
    const newId = invLineItems.length > 0 ? Math.max(...invLineItems.map(i => i.id)) + 1 : 1
    const item: InvoiceLineItem =
      type === 'time'
        ? { id: newId, type: 'time', description: invoiceProfile.speciality || '', durationHours: '0', durationMinutes: '0', rate: String(invoiceProfile.hourlyRate) }
        : type === 'service'
        ? { id: newId, type: 'service', description: '', amount: '0' }
        : { id: newId, type: 'product', description: '', quantity: '1', unitPrice: '0' }
    setInvLineItems(prev => [...prev, item])
    setInvAddMenuOpen(false)
  }

  // Открывает модалку Create Invoice в одном из трёх режимов:
  //   'create' — пустая форма (из FAB-меню)
  //   'manual' — один time-item с 1 часом (кнопка "Create Invoice manually")
  //   'auto'   — time-item заполняется данными из текущего отчёта (итоговые часы + оплата)
  const openInvoiceByTime = (mode: 'create' | 'manual' | 'auto' = 'auto') => {
    if (!requireActive()) return
    const today = toLocalDateKey(new Date())
    const currentMonthKey = toMonthKey(new Date())
    setInvBTForm({
      number: String(invoiceProfile.nextInvoiceNumber),
      date: today,
      clientId: reportClientId ?? soloClientId,
      comments: mode === 'auto' ? [...reportShifts].reverse().map(s => s.comment).filter(Boolean).join('\n') : '',
    })
    if (mode === 'create') {
      setInvLineItems([])
    } else {
      const totalMinutes = mode === 'manual' ? 60 : Math.max(reportTotals.durationMinutes, 0)
      setInvLineItems([{
        id: 1,
        type: 'time',
        description: invoiceProfile.speciality || 'Work shift',
        durationHours: String(Math.floor(totalMinutes / 60)),
        durationMinutes: String(Math.round(totalMinutes % 60)),
        rate: String(invoiceProfile.hourlyRate),
        exactAmount: mode === 'manual' ? undefined : reportTotals.pay,
      }])
    }
    setInvAddMenuOpen(false)
    setInvBTCalendarMonth(currentMonthKey)
    setInvBTCalendarOpen(false)
    setInvBTSuccessData(null)
    setIsFabOpen(false)
    setIsInvoiceByTimeOpen(true)
  }

  // Открывает пустую форму инвойса (для кнопки "+ Create Invoice" в FAB)
  const openCreateInvoice = () => openInvoiceByTime('create')

  // Открывает форму инвойса, предзаполненную данными конкретной смены
  // (вызывается из контекстного меню карточки смены)
  const openInvoiceFromShift = (shift: Shift) => {
    const workMinutes = Math.max(minutesBetween(shift.start, shift.end) - shift.lunchMinutes, 0)
    const hours = workMinutes / 60
    const today = toLocalDateKey(new Date())
    setInvBTForm({
      number: String(invoiceProfile.nextInvoiceNumber),
      date: today,
      clientId: shift.clientId ?? soloClientId,
      comments: shift.comment || '',
    })
    setInvLineItems([{
      id: 1,
      type: 'time',
      description: invoiceProfile.speciality || 'Work shift',
      durationHours: String(Math.floor(workMinutes / 60)),
      durationMinutes: String(Math.round(workMinutes % 60)),
      rate: String(shift.hourlyRate),
      exactAmount: hours * shift.hourlyRate,
    }])
    setInvAddMenuOpen(false)
    setInvBTCalendarMonth(toMonthKey(new Date()))
    setInvBTCalendarOpen(false)
    setInvBTSuccessData(null)
    setIsFabOpen(false)
    setIsInvoiceByTimeOpen(true)
  }

  // Генерирует PDF инвойса и сохраняет его в папку Downloads.
  // После успешной генерации — инкрементирует nextInvoiceNumber и сохраняет профиль.
  // Показывает экран успеха с кнопкой "Send by Email" (mailto-ссылка).
  const generateInvoice = async (
    form: { number: string; date: string; clientId: number | null; comments?: string },
    closeModal: () => void
  ) => {
    if (invLineItems.length === 0) { alert('Please add at least one item.'); return }
    const items = invLineItems.map(item => {
      const amount = calcLineItemAmount(item)
      if (item.type === 'time') {
        const h = parseInt(item.durationHours) || 0
        const m = parseInt(item.durationMinutes) || 0
        const qtyStr = m > 0 ? `${h}h${m}m` : `${h}h`
        return { description: item.description, unitPrice: parseFloat(item.rate) || 0, qty: qtyStr, amount }
      }
      if (item.type === 'product') {
        return { description: item.description, unitPrice: parseFloat(item.unitPrice) || 0, qty: item.quantity, amount }
      }
      return { description: item.description, amount }
    })
    const subtotal = items.reduce((s, i) => s + i.amount, 0)
    const { gstMode } = invoiceProfile
    const gst = gstMode === 'exclusive' ? subtotal * 0.1
      : gstMode === 'inclusive' ? subtotal / 11
      : 0
    const total = gstMode === 'inclusive' ? subtotal : subtotal + gst
    const invNum = parseInt(form.number) || 1
    const period = reportRange ?? { start: form.date, end: form.date }
    const selectedClient = clients.find(c => c.id === form.clientId)
    if (!selectedClient) {
      alert('Selected client not found. Please re-select a client.')
      return
    }
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
        billTo: { name: selectedClient.name, address: selectedClient.address, abn: selectedClient.abn },
        items,
        comments: form.comments || undefined,
        gstMode,
      })
      const nextNumber = invNum >= invoiceProfile.nextInvoiceNumber ? invNum + 1 : invoiceProfile.nextInvoiceNumber + 1
      const updated: InvoiceProfile = { ...invoiceProfile, nextInvoiceNumber: nextNumber }
      setInvoiceProfile(updated)
      setInvoiceDraft(updated)
      await api.saveInvoiceProfile(updated)
      closeModal()
      setInvBTSuccessData({
        clientEmail: selectedClient.email ?? '',
        invNum: String(invNum).padStart(3, '0'),
        date: form.date,
        invoiceFullName: invoiceProfile.fullName,
      })
    } catch (error) {
      console.error('Failed to generate invoice', error)
      alert('Failed to generate invoice.')
    }
  }

  // Обёртка generateInvoice для модалки "Create Invoice by time"
  const generateInvoiceByTime = () => generateInvoice(invBTForm, () => setIsInvoiceByTimeOpen(false))

  // ── Рендер: сплэш-экран ───────────────────────────────────────────────────
  // Показываем анимированный логотип пока appReady=false (данные ещё грузятся)
  if (!appReady) return (
    <div className="splash-screen">
      <img src="/invairo_logo_h_white.png" alt="Invairo" className="splash-logo" />
      <div className="splash-dots"><span /><span /><span /></div>
    </div>
  )

  return (
    <div className="app-shell" onClick={() => { if (openMenuShiftId) setOpenMenuShiftId(null) }}>


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
              <button className="menu-panel-item" onClick={openClients}><Users size={18} />Clients</button>
              <button className="menu-panel-item" onClick={openProducts}><Package size={18} />Products</button>
              <button className="menu-panel-item" onClick={openSettings}><SettingsIcon size={18} />Settings</button>
              <button className="menu-panel-item" onClick={openInvoiceModal}><FileText size={18} />Invoice details</button>

              <button className="menu-panel-item" onClick={() => { setIsMenuOpen(false); navigate('/app/billing') }}><Banknote size={18} />Subscription</button>
              <hr className="menu-panel-divider" />
              <button className="menu-panel-item danger" onClick={handleLogout}><LogOut size={18} />Log out</button>
            </div>
          </div>
        </>
      )}

      {/* INVOICE BY TIME MODAL */}
      <CreateInvoiceModal
        isOpen={isInvoiceByTimeOpen}
        form={invBTForm}
        setForm={setInvBTForm}
        lineItems={invLineItems}
        setLineItems={setInvLineItems}
        calendarOpen={invBTCalendarOpen}
        setCalendarOpen={setInvBTCalendarOpen}
        calendarMonth={invBTCalendarMonth}
        setCalendarMonth={setInvBTCalendarMonth}
        calendarCells={invBTCalendarCells}
        calendarLabel={invBTCalendarLabel}
        addMenuOpen={invAddMenuOpen}
        setAddMenuOpen={setInvAddMenuOpen}
        clients={clients}
        invoiceProfile={invoiceProfile}
        todayIso={todayIso}
        calendarWeekLabels={calendarWeekLabels}
        successData={invBTSuccessData}
        onClose={() => setIsInvoiceByTimeOpen(false)}
        onAddClient={() => openAddClientFromInvoice('invoiceByTime')}
        onAddItem={addLineItem}
        onGenerate={generateInvoiceByTime}
        onSuccessClose={() => setInvBTSuccessData(null)}
      />

      {/* ОСНОВНОЙ КОНТЕНТ — зависит от activeView: 'home' | 'reports' | 'calendar' | 'clients' | 'products' */}
      <main className="content">
        {activeView === 'home' ? (
          <>
            {/* Карточка с суммарными часами за текущий период (неделю/месяц) */}
            <section className="overview">
              <div className="overview-label">Total duration</div>
              <div className="overview-period">{periodLabel}</div>
              <div className="overview-value">{formatDurationPadded(totalDurationMinutes)}</div>
            </section>

            {/* Список смен, сгруппированных по неделям (This Week / Last Week / ...) */}
            <div className="shift-list">
              {shiftGroups.length === 0 && (
                <div className="report-row empty">No shifts yet. Add your first shift.</div>
              )}
              {visibleGroups.map((group) => (
                <div key={group.label}>
                  <div className="section-header">{group.label}</div>
                  {group.shifts.map((shift) => {
                    const workedMinutes = minutesBetween(shift.start, shift.end) - shift.lunchMinutes
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
                                <button className="shift-context-item" onClick={() => { openInvoiceFromShift(shift); setOpenMenuShiftId(null) }}>Create Invoice</button>
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
                            <div className="shift-icon-badge clock"><Timer size={16} /></div>
                            <span>{formatDurationPadded(workedMinutes)}</span>
                          </div>
                        </div>
                        {shift.comment && <div className="comment">"{shift.comment}"</div>}
                      </article>
                    )
                  })}
                </div>
              ))}
              {hasMoreGroups && (
                <button className="show-more-btn" onClick={() => setWeeksVisible(w => w + 2)}>
                  Show more
                </button>
              )}
            </div>
          </>
        ) : activeView === 'reports' ? (
          <section className="reports-page">
            {/* Навигация по периодам: кнопки ◀ ▶ и метка диапазона дат */}
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

            {/* Фильтр по клиенту; скрыт если клиент один — он выбирается автоматически */}
            <div className="reports-client-wrap">
              <select
                className="reports-client-select"
                value={reportClientId ?? ''}
                onChange={e => setReportClientId(e.target.value === '' ? null : Number(e.target.value))}
              >
                {clients.length === 0 && <option value="" disabled>Add new Client</option>}
                {clients.length > 1 && <option value="">All Clients</option>}
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Кнопка "Invoice by Period" — открывает Create Invoice с данными отчёта.
                Disabled если нет клиента, не заполнен профиль или нет смен в периоде */}
            <button
              className="reports-create-invoice-btn"
              onClick={() => openInvoiceByTime()}
              disabled={reportClientId === null || !hasInvoiceCoreFields || reportShifts.length === 0}
            >
              <FileText size={18} />
              Invoice by Period
            </button>

            {/* Карточка с итогами: Work / Lunch / Earnings */}
            <div className="reports-stats-card">
              <div className="reports-stat-item">
                <div className="reports-stat-icon"><Clock size={20} /></div>
                <div className="reports-stat-label">Work</div>
                <div className="reports-stat-value">{formatDurationPadded(reportTotals.durationMinutes)}</div>
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

            {/* Список карточек смен за период, отсортированных по дате (убывание) */}
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
                              <button className="shift-context-item" onClick={() => { openInvoiceFromShift(shift); setOpenMenuShiftId(null) }}>Create Invoice</button>
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
                <div key={client.id} className="shift-card" style={{ cursor: 'pointer' }} onClick={() => setOpenMenuClientId(null)}>
                  <div className="shift-card__header">
                    <div>
                      <div className="shift-date">{client.name}</div>
                      {client.email && <div className="label" style={{ marginTop: 2 }}>{client.email}</div>}
                    </div>
                    <div style={{ position: 'relative', alignSelf: 'flex-start' }}>
                      <button
                        className="shift-menu-btn"
                        onClick={e => { e.stopPropagation(); setOpenMenuClientId(openMenuClientId === client.id ? null : client.id) }}
                      >
                        <MoreVertical size={16} />
                      </button>
                      {openMenuClientId === client.id && (
                        <div className="shift-context-menu">
                          <button className="shift-context-item" onClick={() => { openEditClient(client); setOpenMenuClientId(null) }}>Edit</button>
                          <button className="shift-context-item danger" onClick={() => { handleDeleteClient(client.id); setOpenMenuClientId(null) }}>Delete</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </section>
        ) : activeView === 'products' ? (
          <section className="clients-section">
            <div className="modal-header" style={{ marginBottom: '12px' }}>
              <div className="modal-title">Products</div>
              <button className="add-action-btn" onClick={openAddProduct}>+ Add Product</button>
            </div>
            {products.length === 0 ? (
              <div className="report-row empty">No products yet. Add your first product.</div>
            ) : (
              products.map(product => (
                <div key={product.id} className="shift-card" onClick={() => setOpenMenuProductId(null)}>
                  <div className="shift-card__header">
                    <div>
                      <div className="shift-date">{product.name}</div>
                      <div className="label" style={{ marginTop: 2 }}>${product.price.toFixed(2)}</div>
                    </div>
                    <div style={{ position: 'relative', alignSelf: 'flex-start' }}>
                      <button
                        className="shift-menu-btn"
                        onClick={e => { e.stopPropagation(); setOpenMenuProductId(openMenuProductId === product.id ? null : product.id) }}
                      >
                        <MoreVertical size={16} />
                      </button>
                      {openMenuProductId === product.id && (
                        <div className="shift-context-menu">
                          <button className="shift-context-item" onClick={() => { openEditProduct(product); setOpenMenuProductId(null) }}>Edit</button>
                          <button className="shift-context-item danger" onClick={() => { handleDeleteProduct(product.id); setOpenMenuProductId(null) }}>Delete</button>
                        </div>
                      )}
                    </div>
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
                              <button className="shift-context-item" onClick={() => { openInvoiceFromShift(shift); setOpenMenuShiftId(null) }}>Create Invoice</button>
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
                          <div className="shift-icon-badge clock"><Timer size={16} /></div>
                          <span>{formatDurationPadded(workedMinutes)}</span>
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

      {/* FAB — плавающая кнопка (круглая, снизу справа).
          На не-home экранах показываем иконку "Home" для возврата.
          На главном экране раскрывается в меню: Invoice / New Shift / Reports */}
      {activeView === 'reports' || activeView === 'calendar' || activeView === 'clients' || activeView === 'products' ? (
        <button className="floating-btn" onClick={goHome}>
          <Home size={24} />
        </button>
      ) : activeView === 'home' && (
        <>
          {isFabOpen && <div className="fab-backdrop" onClick={() => setIsFabOpen(false)} />}
          {isFabOpen && (
            <div className="fab-menu">
              <button className="fab-menu-item" onClick={openCreateInvoice}>
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
            </div>
          )}
          <button className="floating-btn" onClick={() => setIsFabOpen(prev => !prev)}>
            {isFabOpen ? <X size={24} /> : <Plus size={24} />}
          </button>
        </>
      )}

      {/* МОДАЛКА ДОБАВЛЕНИЯ / РЕДАКТИРОВАНИЯ СМЕНЫ
          Полноэкранная. Содержит: дата (встроенный календарь), клиент (select),
          время начала и конца (открывают bottom-sheet WheelPicker), обед, комментарий */}
      {isAddOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal modal--fullscreen" onClick={(e) => e.stopPropagation()}>
            <div className="inv-header">
              <div className="inv-header-left">
                <Clock size={20} />
                <span className="inv-header-title">{editingId ? 'Edit shift' : 'New shift'}</span>
              </div>
              <button className="inv-close-btn" onClick={closeModal}><X size={18} /></button>
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
              <div className="field">
                <div className="field-label-row">
                  <span className="label">Client</span>
                  <button type="button" className="add-action-btn" onClick={() => openAddClientFromInvoice('shiftForm')}>+ Add Client</button>
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

            <div className="inv-footer">
              <button className="ghost-button" onClick={closeModal}>Cancel</button>
              <button className="primary-btn" style={{ flex: 1 }} onClick={handleSave} disabled={form.clientId === null}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM SHEET: выбор времени начала/конца смены.
          Появляется поверх всего (z-index 300/301) при нажатии на поле Start/End.
          Два WheelPicker — часы (0–23) и минуты (шаг 5). */}
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

      {/* BOTTOM SHEET: выбор длительности обеда (0–120 минут, шаг 5). */}
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

      {/* МОДАЛКА КЛИЕНТА: добавление или редактирование.
          Поля: имя, адрес, ABN, email. Используется и из меню, и из контекста инвойса/смены. */}
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

      {/* МОДАЛКА ПРОДУКТА: добавление или редактирование. Поля: название, цена. */}
      {isProductModalOpen && (
        <div className="modal-backdrop" onClick={closeProductModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header-dark">
              <div className="modal-title-dark">{editingProductId !== null ? 'Edit Product' : 'Add Product'}</div>
              <button className="modal-close-btn" onClick={closeProductModal}><X size={18} /></button>
            </div>
            <div className="form-grid" style={{ marginTop: '12px' }}>
              <label className="field">
                <span className="label">Product Name</span>
                <input
                  className="input"
                  type="text"
                  value={productDraft.name}
                  onChange={e => setProductDraft(prev => ({ ...prev, name: e.target.value }))}
                  autoFocus
                />
              </label>
              <label className="field">
                <span className="label">Price</span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={productDraft.price || ''}
                  onChange={e => setProductDraft(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                />
              </label>
            </div>
            <button className="primary-btn" style={{ marginTop: '16px' }} onClick={saveProduct}>Save</button>
          </div>
        </div>
      )}

      {/* ПОПАП АПГРЕЙДА: показывается когда Trial/Solo-план пытается добавить 2+ клиентов/продуктов */}
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

      {/* ПОПАП ИСТЁКШЕГО ТРИАЛА: показывается при попытке использовать платные функции
          после окончания 30-дневного пробного периода */}
      {isExpiredModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsExpiredModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header-dark">
              <div className="modal-title-dark">Free Trial Ended</div>
              <button className="modal-close-btn" onClick={() => setIsExpiredModalOpen(false)}><X size={18} /></button>
            </div>
            <div style={{ padding: '8px 0 4px', textAlign: 'center' }}>
              <p style={{ marginBottom: '6px' }}>Your free trial has ended.</p>
              <p style={{ marginBottom: '24px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                Subscribe to continue using invoices, clients, and products. Time tracking is always free.
              </p>
              <button
                className="primary-btn"
                onClick={() => { setIsExpiredModalOpen(false); navigate('/app/billing') }}
              >
                View Plans →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* МОДАЛКА SETTINGS: выбор периода отчёта (weekly/monthly/custom) и начала недели.
          При "Custom dates" — показывает два встроенных календаря (Date from / Date to)
          и кнопку "Report" (не сохраняет настройки, только устанавливает customReportRange).
          При weekly/monthly — кнопка "Save" сохраняет настройки. */}
      {isSettingsOpen && (
        <div className="modal-backdrop" onClick={closeSettings}>
          <div className="modal modal--fullscreen" onClick={(e) => e.stopPropagation()}>
            <div className="inv-header">
              <div className="inv-header-left">
                <SettingsIcon size={20} />
                <span className="inv-header-title">Settings</span>
              </div>
              <button className="inv-close-btn" onClick={closeSettings}><X size={18} /></button>
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

              {/* Кастомный диапазон: два встроенных мини-календаря.
                  Даты хранятся в customReportFrom/To — НЕ сохраняются в настройках! */}
              {settingsDraft.period === 'custom' && (
                <>
                  <div className="field">
                    <span className="label">Date from</span>
                    <button type="button" className="form-field-btn" onClick={() => { setSettingsFromCalOpen(p => !p); setSettingsToCalOpen(false) }}>
                      {formatDate(customReportFrom)}
                    </button>
                    {settingsFromCalOpen && (
                      <div className="form-calendar">
                        <div className="form-calendar-header">
                          <button type="button" className="nav-btn" onClick={() => setSettingsFromCalMonth(prev => shiftMonthKey(prev, -1))}><ChevronLeft size={16} /></button>
                          <span className="form-calendar-title">{settingsFromCalLabel}</span>
                          <button type="button" className="nav-btn" onClick={() => setSettingsFromCalMonth(prev => shiftMonthKey(prev, 1))}><ChevronRight size={16} /></button>
                        </div>
                        <div className="calendar-weekdays">
                          {calendarWeekLabels.map(l => <div key={l} className="calendar-weekday">{l}</div>)}
                        </div>
                        <div className="calendar-grid">
                          {settingsFromCalCells.map((cell, idx) => {
                            if (!cell.date || !cell.day) return <div key={`sf-${idx}`} className="calendar-day-empty" />
                            const isSelected = cell.date === customReportFrom
                            const isToday = cell.date === todayIso
                            return (
                              <button key={cell.date} type="button"
                                className={`calendar-day${isSelected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}`}
                                onClick={() => { setCustomReportFrom(cell.date!); setSettingsFromCalOpen(false) }}
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
                    <span className="label">Date to</span>
                    <button type="button" className="form-field-btn" onClick={() => { setSettingsToCalOpen(p => !p); setSettingsFromCalOpen(false) }}>
                      {formatDate(customReportTo)}
                    </button>
                    {settingsToCalOpen && (
                      <div className="form-calendar">
                        <div className="form-calendar-header">
                          <button type="button" className="nav-btn" onClick={() => setSettingsToCalMonth(prev => shiftMonthKey(prev, -1))}><ChevronLeft size={16} /></button>
                          <span className="form-calendar-title">{settingsToCalLabel}</span>
                          <button type="button" className="nav-btn" onClick={() => setSettingsToCalMonth(prev => shiftMonthKey(prev, 1))}><ChevronRight size={16} /></button>
                        </div>
                        <div className="calendar-weekdays">
                          {calendarWeekLabels.map(l => <div key={l} className="calendar-weekday">{l}</div>)}
                        </div>
                        <div className="calendar-grid">
                          {settingsToCalCells.map((cell, idx) => {
                            if (!cell.date || !cell.day) return <div key={`st-${idx}`} className="calendar-day-empty" />
                            const isSelected = cell.date === customReportTo
                            const isToday = cell.date === todayIso
                            return (
                              <button key={cell.date} type="button"
                                className={`calendar-day${isSelected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}`}
                                onClick={() => { setCustomReportTo(cell.date!); setSettingsToCalOpen(false) }}
                              >
                                <span className="calendar-day-number">{cell.day}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

            </div>

            <div className="inv-footer">
              <button className="ghost-button" onClick={closeSettings}>Cancel</button>
              {/* "Report": устанавливает customReportRange (не сохраняет settings!), переходит в отчёты */}
              {settingsDraft.period === 'custom' ? (
                <button className="primary-btn" style={{ flex: 1 }} onClick={() => {
                  if (customReportFrom > customReportTo) {
                    alert('"Date from" cannot be later than "Date to"')
                    return
                  }
                  setCustomReportRange({ start: customReportFrom, end: customReportTo })
                  closeSettings()
                  setActiveView('reports')
                  setReportClientId(soloClientId)
                }}>Report</button>
              ) : (
                <button className="primary-btn" style={{ flex: 1 }} onClick={saveSettings}>Save</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* МОДАЛКА "MY INVOICE DETAILS": данные для PDF-инвойса.
          Поля: имя, адрес, ABN, специальность, банковские реквизиты, номер следующего инвойса.
          Ставки: почасовая (weekday), опционально weekend.
          Режим GST: none / exclusive (добавить 10%) / inclusive (уже включён в ставку). */}
      {isInvoiceModalOpen && (
        <div className="modal-backdrop" onClick={closeInvoiceModal}>
          <div className="modal modal--fullscreen" onClick={(e) => e.stopPropagation()}>
            <div className="inv-header">
              <div className="inv-header-left">
                <FileText size={20} />
                <span className="inv-header-title">My Invoice Details</span>
              </div>
              <button className="inv-close-btn" onClick={closeInvoiceModal}><X size={18} /></button>
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

              <label className="field">
                <span className="label">Weekday rate (AUD/hr)</span>
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
                      setInvoiceDraft((prev) => ({ ...prev, hourlyRate: Math.max(0, parsed) }))
                    }
                  }}
                  onBlur={(e) => {
                    const parsed = parseDecimal(e.target.value)
                    const safe = Math.max(0, parsed ?? invoiceDraft.hourlyRate ?? 0)
                    setHourlyRateInput(String(safe))
                    setInvoiceDraft((prev) => ({ ...prev, hourlyRate: safe }))
                  }}
                />
              </label>

              <div className="field">
                <div className="toggle-row">
                  <span className="label">Different rate for weekends</span>
                  <button
                    type="button"
                    className={`toggle-btn ${invoiceDraft.weekendRateEnabled ? 'is-on' : ''}`}
                    onClick={() => setInvoiceDraft(prev => ({ ...prev, weekendRateEnabled: !prev.weekendRateEnabled }))}
                  >
                    <span className="toggle-knob" />
                  </button>
                </div>
              </div>

              {invoiceDraft.weekendRateEnabled && (
                <label className="field">
                  <span className="label">Weekend rate (AUD/hr)</span>
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
                        setInvoiceDraft((prev) => ({ ...prev, weekendRate: Math.max(0, parsed) }))
                      }
                    }}
                    onBlur={(e) => {
                      const parsed = parseDecimal(e.target.value)
                      const safe = Math.max(0, parsed ?? invoiceDraft.weekendRate ?? 0)
                      setWeekendRateInput(String(safe))
                      setInvoiceDraft((prev) => ({ ...prev, weekendRate: safe }))
                    }}
                  />
                </label>
              )}

              <div className="field">
                <span className="label">GST</span>
                <div className="radio-group">
                  <label className="radio-option">
                    <input type="radio" name="gstMode" value="none"
                      checked={invoiceDraft.gstMode === 'none'}
                      onChange={() => setInvoiceDraft(p => ({ ...p, gstMode: 'none' }))} />
                    No GST
                  </label>
                  <label className="radio-option">
                    <input type="radio" name="gstMode" value="exclusive"
                      checked={invoiceDraft.gstMode === 'exclusive'}
                      onChange={() => setInvoiceDraft(p => ({ ...p, gstMode: 'exclusive' }))} />
                    Add GST on top (10%)
                  </label>
                  <label className="radio-option">
                    <input type="radio" name="gstMode" value="inclusive"
                      checked={invoiceDraft.gstMode === 'inclusive'}
                      onChange={() => setInvoiceDraft(p => ({ ...p, gstMode: 'inclusive' }))} />
                    GST included in rate
                  </label>
                </div>
              </div>
            </div>

            <div className="inv-footer">
              <button className="ghost-button" onClick={closeInvoiceModal}>Cancel</button>
              <button className="primary-btn" style={{ flex: 1 }} onClick={saveInvoiceProfile}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App

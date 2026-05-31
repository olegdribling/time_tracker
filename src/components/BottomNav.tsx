import { Clock, FileText, Receipt } from 'lucide-react'

type View = 'home' | 'invoices' | 'expenses'

interface Props {
  activeView: string
  onNavigate: (view: View) => void
}

const TABS = [
  { view: 'home' as View,     icon: Clock,    label: 'Track Time' },
  { view: 'invoices' as View, icon: FileText, label: 'Invoices'   },
  { view: 'expenses' as View, icon: Receipt,  label: 'Expenses'   },
]

export function BottomNav({ activeView, onNavigate }: Props) {
  return (
    <nav className="bottom-nav">
      {TABS.map(({ view, icon: Icon, label }) => (
        <button
          key={view}
          className={`bottom-nav__tab${activeView === view ? ' bottom-nav__tab--active' : ''}`}
          onClick={() => onNavigate(view)}
        >
          <Icon size={22} strokeWidth={activeView === view ? 2.2 : 1.8} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}

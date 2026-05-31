import { useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type ActionItem = {
  kind: 'action'
  icon: LucideIcon
  label: string
  onClick: () => void
}

type FileItem = {
  kind: 'file'
  icon: LucideIcon
  label: string
  accept: string
  capture?: 'environment' | 'user'
  onFile: (file: File) => void
}

export type FabItem = ActionItem | FileItem

interface Props {
  items: FabItem[]
}

export function GlobalFab({ items }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({})

  if (items.length === 0) return null

  const close = () => setIsOpen(false)

  const handleAction = (item: FabItem, idx: number) => {
    close()
    if (item.kind === 'action') {
      item.onClick()
    } else {
      fileRefs.current[idx]?.click()
    }
  }

  return (
    <>
      {/* Hidden file inputs for file-picker items */}
      {items.map((item, idx) =>
        item.kind === 'file' ? (
          <input
            key={idx}
            ref={el => { fileRefs.current[idx] = el }}
            type="file"
            accept={item.accept}
            {...(item.capture ? { capture: item.capture } : {})}
            style={{ display: 'none' }}
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) item.onFile(file)
              e.currentTarget.value = ''
            }}
          />
        ) : null
      )}

      {/* Backdrop */}
      {isOpen && (
        <div className="fab-backdrop" onClick={close} />
      )}

      {/* Menu items */}
      {isOpen && (
        <div className="fab-menu">
          {items.map((item, idx) => {
            const Icon = item.icon
            return (
              <button
                key={idx}
                className="fab-menu-item"
                onClick={() => handleAction(item, idx)}
              >
                <span className="fab-menu-icon">
                  <Icon size={18} />
                </span>
                {item.label}
              </button>
            )
          })}
        </div>
      )}

      {/* FAB button */}
      <button
        className={`floating-btn${isOpen ? ' floating-btn--open' : ''}`}
        onClick={() => setIsOpen(o => !o)}
        aria-label="Actions"
      >
        <Plus size={24} strokeWidth={2.5} style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(45deg)' : 'none' }} />
      </button>
    </>
  )
}

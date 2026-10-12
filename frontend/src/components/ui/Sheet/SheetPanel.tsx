// Adapted from SmoothUI (MIT), https://smoothui.dev
import { m, useReducedMotion } from 'motion/react'
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/utils/utils'
import { trapTab, useDialogFocus, useScrollLock } from './focus'

type SheetSide = 'left' | 'right' | 'bottom'

const SPRING = { type: 'spring', bounce: 0, duration: 0.3 } as const
const INSTANT = { duration: 0 } as const
const OFFSCREEN = { left: { x: '-100%' }, right: { x: '100%' }, bottom: { y: '100%' } } as const
const sideClasses = {
  left: 'inset-y-0 left-0 w-full max-w-sidebar border-r',
  right: 'inset-y-0 right-0 w-full max-w-sheet border-l',
  bottom: 'inset-x-0 top-12 bottom-0 rounded-t-lg border-t',
} as const

export interface SheetPanelProps {
  onClose: () => void
  side: SheetSide
  title: string
  description?: string
  children: ReactNode
}

export function SheetPanel({ onClose, side, title, description, children }: SheetPanelProps) {
  const reduce = useReducedMotion() ?? false
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const headingRef = useDialogFocus<HTMLHeadingElement>()
  useScrollLock()
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      // Listeners behind the modal (an open mistake panel) must not close too.
      event.stopPropagation()
      onClose()
    } else if (panelRef.current) trapTab(event, panelRef.current)
  }
  return (
    <>
      <m.div role="presentation" className="fixed inset-0 z-overlay bg-scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={reduce ? INSTANT : { duration: 0.2 }} />
      <m.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        // A click on plain content focuses the panel instead of dropping focus to <body>, so Esc and Tab keep working.
        tabIndex={-1}
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn('fixed z-overlay flex flex-col overflow-y-auto border-border bg-bg shadow-lg outline-none', sideClasses[side])}
        onKeyDown={onKeyDown}
        initial={reduce ? false : OFFSCREEN[side]}
        animate={{ x: 0, y: 0 }}
        exit={reduce ? { opacity: 0 } : OFFSCREEN[side]}
        transition={reduce ? INSTANT : SPRING}
      >
        <div className="sticky top-0 z-sticky flex items-start justify-between gap-4 border-b border-border bg-bg px-4 py-3 md:px-6">
          <div className="flex flex-col gap-1">
            <h2 id={titleId} ref={headingRef} tabIndex={-1} className="text-xl font-light tracking-tight">
              {title}
            </h2>
            {description && <p id={descriptionId} className="text-sm text-muted">{description}</p>}
          </div>
          <Button variant="icon" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </Button>
        </div>
        <div className="flex-1 px-4 py-4 md:px-6">{children}</div>
      </m.div>
    </>
  )
}

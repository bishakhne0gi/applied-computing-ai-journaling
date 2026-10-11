// Adapted from SmoothUI (MIT), https://smoothui.dev
import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/utils/utils'

export type TooltipAlign = 'start' | 'center' | 'end'

export interface TooltipProps {
  content: string
  align?: TooltipAlign
  children: ReactNode
}

const SPRING = { type: 'spring', bounce: 0.1, duration: 0.25 } as const
// Edge alignment keeps a 12rem tip inside a 375px screen for chips near either edge.
const alignClasses: Record<TooltipAlign, string> = { start: 'left-0', center: 'left-1/2 -translate-x-1/2', end: 'right-0' }

export function Tooltip({ content, align = 'center', children }: TooltipProps) {
  const reduce = useReducedMotion() ?? false
  const [open, setOpen] = useState(false)
  const id = useId()
  // Hover and focus already opened it by the time the click lands, so that first click must not close it again.
  const openedByPointerOrFocus = useRef(false)
  const reveal = () => {
    openedByPointerOrFocus.current = true
    setOpen(true)
  }
  const hide = () => {
    openedByPointerOrFocus.current = false
    setOpen(false)
  }
  const toggle = () => {
    if (openedByPointerOrFocus.current) {
      openedByPointerOrFocus.current = false
      return
    }
    setOpen((was) => !was)
  }
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') hide()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])
  // Focus is on the trigger, so Escape is handled here and stopped before an enclosing Sheet sees it; the document
  // listener above only covers a hover-opened tip, and never stops propagation.
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Escape' || !open) return
    event.stopPropagation()
    hide()
  }
  const hidden = reduce ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.96 }
  return (
    <span className="relative inline-flex" onMouseEnter={reveal} onMouseLeave={hide}>
      <Button variant="plain" aria-describedby={open ? id : undefined} onFocus={reveal} onBlur={hide} onKeyDown={onKeyDown} onClick={toggle}>
        {children}
      </Button>
      <AnimatePresence>
        {open && (
          <m.span
            id={id}
            role="tooltip"
            className={cn('pointer-events-none absolute bottom-full z-dropdown mb-2 w-48 rounded-md bg-fg px-3 py-2 text-xs text-bg shadow-md', alignClasses[align])}
            initial={hidden}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={hidden}
            transition={reduce ? { duration: 0 } : SPRING}
          >
            {content}
          </m.span>
        )}
      </AnimatePresence>
    </span>
  )
}

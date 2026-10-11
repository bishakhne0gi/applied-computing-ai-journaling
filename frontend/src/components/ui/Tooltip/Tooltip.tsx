// Adapted from SmoothUI (MIT), https://smoothui.dev
import { m, useReducedMotion } from 'motion/react'
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/utils/utils'

export type TooltipAlign = 'start' | 'center' | 'end'

export interface TooltipProps {
  content: ReactNode
  align?: TooltipAlign
  children: ReactNode
}

const SPRING = { type: 'spring', bounce: 0.1, duration: 0.25 } as const
// Edge alignment keeps a 12rem tip inside a 375px screen for chips near either edge.
const EDGE = 8
const alignClasses: Record<TooltipAlign, string> = { start: 'left-0', center: 'left-1/2 -translate-x-1/2', end: 'right-0' }

// A trigger that wraps onto a second row can leave the tip hanging off a screen edge, so nudge it back inside. The
// offset is dynamic and can't be a token utility, so it is set on the element rather than through a style prop.
function useKeepInViewport(ref: RefObject<HTMLElement | null>, open: boolean) {
  useLayoutEffect(() => {
    const element = ref.current
    if (!open || !element) return
    element.style.left = '0px'
    const { left, right } = element.getBoundingClientRect()
    const overflow = left < EDGE ? EDGE - left : Math.min(0, document.documentElement.clientWidth - EDGE - right)
    element.style.left = `${overflow}px`
  }, [open, ref])
}

export function Tooltip({ content, align = 'center', children }: TooltipProps) {
  const reduce = useReducedMotion() ?? false
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLSpanElement>(null)
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
  useKeepInViewport(anchor, open)
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
      <Button variant="plain" className="min-h-11 md:min-h-9" aria-describedby={id} onFocus={reveal} onBlur={hide} onKeyDown={onKeyDown} onClick={toggle}>
        {children}
      </Button>
      {/* Always in the DOM so the hint is described on focus; padding, not margin, bridges the gap so the pointer can reach the tip. */}
      <span className={cn(open ? 'absolute bottom-full z-dropdown pb-2' : 'sr-only', alignClasses[align])}>
        <span ref={anchor} className="relative block">
          <m.span
            id={id}
            role="tooltip"
            data-state={open ? 'open' : 'closed'}
            className="block w-64 rounded-md bg-fg px-3 py-2 text-xs text-bg shadow-md"
            initial={false}
            animate={open ? { opacity: 1, y: 0, scale: 1 } : hidden}
            transition={reduce ? { duration: 0 } : SPRING}
          >
            {content}
          </m.span>
        </span>
      </span>
    </span>
  )
}

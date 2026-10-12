// Adapted from SmoothUI (MIT), https://smoothui.dev
import { m, useReducedMotion } from 'motion/react'
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { cn } from '@/utils/utils'

export type TooltipAlign = 'start' | 'center' | 'end'

export interface TooltipProps {
  content: ReactNode
  align?: TooltipAlign
  // Below when the space above holds something the tip must not cover (a page subtitle, a heading).
  placement?: 'top' | 'bottom'
  // `card`: a wider light panel for a few rows of explanation; `hint` (default): a short dark label.
  size?: 'hint' | 'card'
  children: ReactNode
}

const SPRING = { type: 'spring', bounce: 0.1, duration: 0.25 } as const
// Edge alignment keeps a 12rem tip inside a 375px screen for chips near either edge.
const EDGE = 8
const alignClasses: Record<TooltipAlign, string> = { start: '', center: '-translate-x-1/2', end: '-translate-x-full' }
const placementClasses = { top: '-translate-y-full pb-2', bottom: 'pt-2' } as const
const sizeClasses = {
  hint: 'w-64 rounded-md bg-fg px-3 py-2 text-xs text-bg shadow-md',
  card: 'w-80 rounded-lg border border-border bg-bg p-4 text-sm text-fg shadow-lg sm:w-md',
} as const

// Where the tip floats and how it enters: it rises from below its anchor, or drops from above when placed below.
function tipLayout(open: boolean, placement: 'top' | 'bottom', align: TooltipAlign, reduce: boolean) {
  const wrapper = open ? cn('fixed top-0 left-0 z-tooltip', placementClasses[placement], alignClasses[align]) : 'sr-only'
  const hidden = reduce ? { opacity: 0 } : { opacity: 0, y: placement === 'top' ? 4 : -4, scale: 0.96 }
  return { wrapper, hidden }
}

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

function pinTip(trigger: HTMLElement, tip: HTMLElement, placement: 'top' | 'bottom', align: TooltipAlign) {
  const rect = trigger.getBoundingClientRect()
  tip.style.left = `${{ start: rect.left, center: rect.left + rect.width / 2, end: rect.right }[align]}px`
  tip.style.top = `${placement === 'top' ? rect.top : rect.bottom}px`
}

// The open tip lives in <body> so a scrolling ancestor (a list of versions, a sheet) can't clip it; it is pinned to
// its trigger here and follows it while anything scrolls or the window resizes.
function usePinToTrigger(trigger: RefObject<HTMLElement | null>, tip: RefObject<HTMLElement | null>, open: boolean, placement: 'top' | 'bottom', align: TooltipAlign) {
  useLayoutEffect(() => {
    const from = trigger.current
    const to = tip.current
    if (!open || !from || !to) return
    const pin = () => pinTip(from, to, placement, align)
    pin()
    window.addEventListener('scroll', pin, true)
    window.addEventListener('resize', pin)
    return () => {
      window.removeEventListener('scroll', pin, true)
      window.removeEventListener('resize', pin)
    }
  }, [trigger, tip, open, placement, align])
}

interface FloatingTipProps extends Required<Pick<TooltipProps, 'content' | 'align' | 'placement' | 'size'>> {
  id: string
  open: boolean
  trigger: RefObject<HTMLElement | null>
}

// Always in the DOM so the hint is described on focus; padding, not margin, bridges the gap so the pointer can reach
// the tip. React's enter and leave follow the component tree, so moving onto the portalled tip keeps it open.
function FloatingTip({ id, open, trigger, content, align, placement, size }: FloatingTipProps) {
  const reduce = useReducedMotion() ?? false
  const floating = useRef<HTMLSpanElement>(null)
  const anchor = useRef<HTMLSpanElement>(null)
  usePinToTrigger(trigger, floating, open, placement, align)
  useKeepInViewport(anchor, open)
  const { wrapper, hidden } = tipLayout(open, placement, align, reduce)
  return createPortal(
    <span ref={floating} className={wrapper}>
      <span ref={anchor} className="relative block">
        <m.span
          id={id}
          role="tooltip"
          data-state={open ? 'open' : 'closed'}
          className={cn('block', sizeClasses[size])}
          initial={false}
          animate={open ? { opacity: 1, y: 0, scale: 1 } : hidden}
          transition={reduce ? { duration: 0 } : SPRING}
        >
          {content}
        </m.span>
      </span>
    </span>,
    document.body,
  )
}

export function Tooltip({ content, align = 'center', placement = 'top', size = 'hint', children }: TooltipProps) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLSpanElement>(null)
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
  return (
    <span ref={trigger} className="relative inline-flex" onMouseEnter={reveal} onMouseLeave={hide}>
      <Button variant="plain" className="min-h-11 md:min-h-9" aria-describedby={id} onFocus={reveal} onBlur={hide} onKeyDown={onKeyDown} onClick={toggle}>
        {children}
      </Button>
      <FloatingTip id={id} open={open} trigger={trigger} content={content} align={align} placement={placement} size={size} />
    </span>
  )
}

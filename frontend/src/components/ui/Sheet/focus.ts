// Adapted from SmoothUI (MIT), https://smoothui.dev
import { useEffect, useRef, type KeyboardEvent, type RefObject } from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Tab and Shift+Tab wrap inside the dialog; from the heading (tabIndex -1, focused on open) they enter at the edge.
export function trapTab(event: KeyboardEvent<HTMLElement>, container: HTMLElement): void {
  if (event.key !== 'Tab') return
  const items = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
  const first = items[0]
  const last = items.at(-1)
  if (!first || !last) {
    event.preventDefault()
    return
  }
  const active = document.activeElement
  const edge = event.shiftKey ? first : last
  if (active === edge || !items.some((item) => item === active)) {
    event.preventDefault()
    ;(event.shiftKey ? last : first).focus()
  }
}

// Focus moves to the heading on open and back to the opener on close — unless the user already moved on (picked an
// entry whose heading took focus), which closing must not undo. By cleanup time the panel is out of the DOM, so
// focus that was inside it has fallen back to <body>.
export function useDialogFocus<T extends HTMLElement>(): RefObject<T | null> {
  const headingRef = useRef<T>(null)
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const panel = headingRef.current?.closest('[role="dialog"]') ?? null
    headingRef.current?.focus()
    return () => {
      const active = document.activeElement
      const abandoned = active === null || active === document.body || (panel?.contains(active) ?? false)
      if (abandoned) opener?.focus()
    }
  }, [])
  return headingRef
}

// A class, not an inline style: the page behind a modal sheet must not scroll under the user's finger.
export function useScrollLock(): void {
  useEffect(() => {
    document.body.classList.add('overflow-hidden')
    return () => document.body.classList.remove('overflow-hidden')
  }, [])
}

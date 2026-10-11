import { useLayoutEffect, type RefObject } from 'react'

// Pixel geometry from the rendered underline cannot be a token, so it is written on the element after layout.
export function useAnchorBelow(ref: RefObject<HTMLElement | null>, decorationId: string): void {
  useLayoutEffect(() => {
    const popover = ref.current
    const frame = popover?.parentElement
    const marks = Array.from(frame?.querySelectorAll<HTMLElement>('mark[data-decoration-id]') ?? [])
    const mark = marks.find((candidate) => candidate.dataset.decorationId === decorationId)
    if (!popover || !frame || !mark) return
    const frameBox = frame.getBoundingClientRect()
    const markBox = mark.getBoundingClientRect()
    const left = Math.min(Math.max(0, markBox.left - frameBox.left), Math.max(0, frameBox.width - popover.offsetWidth))
    popover.style.left = `${left}px`
    popover.style.top = `${markBox.bottom - frameBox.top + 6}px`
  }, [ref, decorationId])
}

import { useLayoutEffect, type RefObject } from 'react'
import { placePopover } from './placePopover'

// Pixel geometry from the rendered underline cannot be a token, so it is written on the element after layout. It is
// re-run on scroll (the textarea scrolls its own text) and resize, so the popover stays on its underline.
export function useAnchorToWord(ref: RefObject<HTMLElement | null>, decorationId: string, onClose: () => void): void {
  useLayoutEffect(() => {
    const popover = ref.current
    const frame = popover?.parentElement
    if (!popover || !frame) return
    const place = () => {
      const mark = Array.from(frame.querySelectorAll<HTMLElement>('mark[data-decoration-id]')).find((candidate) => candidate.dataset.decorationId === decorationId)
      if (!mark) return
      const markBox = mark.getBoundingClientRect()
      const visible = frame.querySelector('textarea')?.getBoundingClientRect()
      // The textarea scrolls its own text, so the word can leave its box; a popover left behind would point at nothing.
      if (visible && (markBox.bottom < visible.top || markBox.top > visible.bottom)) return onClose()
      const at = placePopover(markBox, frame.getBoundingClientRect(), { width: popover.offsetWidth, height: popover.offsetHeight }, { width: window.innerWidth, height: window.innerHeight })
      popover.style.left = `${at.left}px`
      popover.style.top = `${at.top}px`
    }
    place()
    // The textarea's scroll event does not bubble; capture on the frame still sees it. The backdrop follows the
    // textarea in the same event, so measuring waits one frame.
    let pending = 0
    const later = () => {
      cancelAnimationFrame(pending)
      pending = requestAnimationFrame(place)
    }
    frame.addEventListener('scroll', later, true)
    window.addEventListener('resize', later)
    return () => {
      cancelAnimationFrame(pending)
      frame.removeEventListener('scroll', later, true)
      window.removeEventListener('resize', later)
    }
  }, [ref, decorationId, onClose])
}

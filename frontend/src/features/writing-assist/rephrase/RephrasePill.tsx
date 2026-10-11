import { useLayoutEffect, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { repositionOnScroll } from '@/features/live-hints/useRepositionOnScroll'
import { rectAtOffset } from './textNodes'

export interface RephrasePillProps {
  offset: number // where the selection ends, as an index into the textarea value
  onOpen: () => void
}

const GAP = 6

// Floats above the end of a mouse selection. Pixel geometry cannot be a token, so left/top are written after layout
// (the same rule as the hint popover); it follows the textarea's own scrolling and hides when the end is out of view.
export function RephrasePill({ offset, onOpen }: RephrasePillProps) {
  const ref = useRef<HTMLButtonElement>(null)
  useLayoutEffect(() => {
    const pill = ref.current
    const frame = pill?.parentElement
    const backdrop = frame?.querySelector('[data-backdrop]')
    const textarea = frame?.querySelector('textarea')
    if (!pill || !frame || !backdrop || !textarea) return
    const place = () => {
      const end = rectAtOffset(backdrop, offset)
      const visible = textarea.getBoundingClientRect()
      const inside = !!end && end.bottom >= visible.top && end.top <= visible.bottom
      pill.style.visibility = inside ? 'visible' : 'hidden'
      if (!end) return
      const box = frame.getBoundingClientRect()
      const left = end.right - box.left - pill.offsetWidth / 2
      const above = end.top - box.top - pill.offsetHeight - GAP
      pill.style.left = `${Math.min(Math.max(left, 0), Math.max(box.width - pill.offsetWidth, 0))}px`
      // On the first line there is no room above, so it drops below the line instead of leaving the frame.
      pill.style.top = `${above < 0 ? end.bottom - box.top + GAP : above}px`
    }
    place()
    return repositionOnScroll(frame, place)
  }, [offset])
  return (
    <Button
      ref={ref}
      variant="secondary"
      className="absolute z-dropdown min-h-8 gap-1 px-3 text-sm shadow-md"
      tabIndex={-1}
      aria-label="Rephrase selection"
      // Keeps the textarea focused and its selection intact; keyboard users have Alt+R and the toolbar button.
      onPointerDown={(event) => event.preventDefault()}
      onClick={onOpen}
    >
      <Icon name="sparkle" className="size-4 text-primary" />
      Rephrase
    </Button>
  )
}

import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { useAnchorToWord } from '@/features/live-hints/useAnchorToWord'
import { REPHRASE_TARGET_ID } from './rephraseDecorations'
import { revealTarget } from './revealTarget'

export interface RephrasePopoverProps {
  headingId: string
  onClose: () => void // Esc / press outside: the caller puts the caret back on the sentence
  onScrollAway: () => void // the sentence scrolled out of view: close without taking focus; stable, the anchor effect re-subscribes when it changes
  children: ReactNode
}

// A non-modal dialog under the tinted sentence. Opening it was deliberate (button or Alt+R), so it takes focus on the
// selected tab; Esc and a press outside close it and the caller puts the caret back.
export function RephrasePopover({ headingId, onClose, onScrollAway, children }: RephrasePopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  // Declared first so the sentence is in view before the anchor effect measures it; opening after a scroll must not close at once.
  useLayoutEffect(() => revealTarget(ref.current), [])
  useAnchorToWord(ref, REPHRASE_TARGET_ID, onScrollAway)
  useLayoutEffect(() => ref.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus(), [])
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target)) onClose()
    }
    // On document, not the dialog: a toggletip inside handles its own Esc in React and stops it there, so it never
    // reaches this listener; a dialog-level native listener would fire first and close the card as well.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || !(event.target instanceof Node) || !ref.current?.contains(event.target)) return
      event.preventDefault()
      onClose()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])
  return (
    <div
      ref={ref}
      role="dialog"
      aria-labelledby={headingId}
      className="absolute z-dropdown w-md max-w-full">
      <Card className="flex max-h-dvh flex-col gap-3 overflow-y-auto p-4 shadow-lg md:p-4">
        {children}
        <Button variant="icon" aria-label="Close rephrase" className="absolute top-2 right-2" onClick={onClose}>
          <Icon name="close" />
        </Button>
      </Card>
    </div>
  )
}

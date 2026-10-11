import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { useAnchorToWord } from '@/features/live-hints/useAnchorToWord'
import { REPHRASE_TARGET_ID } from './rephraseDecorations'

export interface RephrasePopoverProps {
  headingId: string
  onClose: () => void // stable: the anchor effect re-subscribes when it changes
  children: ReactNode
}

// A non-modal dialog under the tinted sentence. Opening it was deliberate (button or Alt+R), so it takes focus on the
// selected tab; Esc and a press outside close it and the caller puts the caret back.
export function RephrasePopover({ headingId, onClose, children }: RephrasePopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  useAnchorToWord(ref, REPHRASE_TARGET_ID, onClose)
  useLayoutEffect(() => ref.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus(), [])
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      onClose()
    }
    const root = ref.current
    document.addEventListener('pointerdown', onPointerDown)
    root?.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      root?.removeEventListener('keydown', onKeyDown)
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

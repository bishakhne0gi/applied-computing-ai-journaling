import { useRef, type FocusEvent, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Correction } from '@/features/feedback/Correction'
import { useFocusOnMount } from '@/hooks/misc/useFocusOnMount'
import type { LiveHint } from './reanchor'
import { useAnchorBelow } from './useAnchorBelow'

export interface HintPopoverProps {
  hint: LiveHint
  onAccept: () => void
  onDismiss: () => void
  // Closing is not dismissing: the underline stays and the hint can be reopened.
  onClose: () => void
}

// Opened only by a deliberate click on an underline, so taking focus (Enter accepts, Esc dismisses) is expected.
export function HintPopover({ hint, onAccept, onDismiss, onClose }: HintPopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  const acceptRef = useFocusOnMount<HTMLButtonElement>()
  useAnchorBelow(ref, hint.id)
  // Handlers sit on the buttons (the only focusable things inside), not on the dialog element.
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    onDismiss()
  }
  const onBlur = (event: FocusEvent<HTMLButtonElement>) => {
    if (!ref.current?.contains(event.relatedTarget)) onClose()
  }
  const keys = { onKeyDown, onBlur }
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Hint: ${hint.original} should be ${hint.correction}`}
      className="absolute z-dropdown w-72 max-w-full"
    >
      <Card className="flex flex-col gap-2 p-3 text-sm shadow-lg md:p-3">
        <p className="font-semibold">
          <Correction original={hint.original} correction={hint.correction} />
        </p>
        <p className="text-muted">{hint.explanation}</p>
        <div className="flex gap-2">
          <Button ref={acceptRef} variant="primary" className="min-h-9 px-4" onClick={onAccept} {...keys}>
            Accept
            <kbd aria-hidden="true" className="font-sans text-xs opacity-75">
              ↵
            </kbd>
          </Button>
          <Button variant="ghost" className="min-h-9 px-3" onClick={onDismiss} {...keys}>
            Dismiss
            <kbd aria-hidden="true" className="font-sans text-xs text-muted">
              Esc
            </kbd>
          </Button>
        </div>
      </Card>
    </div>
  )
}

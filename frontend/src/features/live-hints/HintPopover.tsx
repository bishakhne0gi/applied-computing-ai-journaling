import { useId, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Correction } from '@/features/feedback/Correction'
import type { LiveHint } from './reanchor'
import { useAnchorToWord } from './useAnchorToWord'
import { usePassivePopover } from './usePassivePopover'

export interface HintPopoverProps {
  hint: LiveHint
  onAccept: () => void
  onDismiss: () => void
  // Closing is not dismissing: the underline stays and the hint can be reopened.
  onClose: () => void
  // Esc inside the popover: closing there would drop focus to the page, so the caller returns it to the text.
  onEscape: () => void
}

// Passive: it opens under a click that was meant to place the caret, so it never takes focus from the text. Tab (or a
// tap) reaches the buttons; Esc closes it from either place.
export function HintPopover({ hint, onAccept, onDismiss, onClose, onEscape }: HintPopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  const explanationId = useId()
  useAnchorToWord(ref, hint.id, onClose)
  usePassivePopover(ref, onClose, onEscape)
  return (
    <div
      ref={ref}
      role="group"
      data-hint-popover=""
      aria-label={`Hint: ${hint.original} should be ${hint.correction}`}
      aria-describedby={explanationId}
      className="absolute z-dropdown w-72 max-w-full"
    >
      <Card className="flex flex-col gap-2 p-3 text-sm shadow-lg md:p-3">
        <p className="font-semibold">
          <Correction original={hint.original} correction={hint.correction} kind={hint.kind} />
        </p>
        <p id={explanationId} className="text-muted">
          {hint.explanation}
        </p>
        <div className="flex gap-2">
          <Button variant="primary" className="min-h-9 px-4" onClick={onAccept}>
            Accept
          </Button>
          <Button variant="ghost" className="min-h-9 px-3" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </Card>
    </div>
  )
}

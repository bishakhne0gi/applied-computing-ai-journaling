import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Correction } from '@/features/feedback/Correction'
import { KIND_LABELS } from '@/features/feedback/labels'
import type { LiveHint } from './reanchor'

export interface HintListProps {
  id: string
  hints: readonly LiveHint[]
  onAccept: (hint: LiveHint) => void
  onDismiss: (hint: LiveHint) => void
}

// The accessible path to hints: underlines are decoration in an aria-hidden layer.
export function HintList({ id, hints, onAccept, onDismiss }: HintListProps) {
  return (
    <ul id={id} aria-label="Live hints" className="flex flex-col gap-2">
      {hints.map((hint) => (
        <li key={hint.id} data-hint-id={hint.id} className="flex flex-col gap-1.5 rounded-md border border-border bg-bg p-3 text-sm">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-medium">
              <Correction original={hint.original} correction={hint.correction} kind={hint.kind} />
            </span>
            <Badge>{KIND_LABELS[hint.kind]}</Badge>
          </p>
          <p className="text-muted">{hint.explanation}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" className="min-h-9 px-4" aria-label={`Accept ${hint.correction} for ${hint.original}`} onClick={() => onAccept(hint)}>
              Accept
            </Button>
            <Button variant="ghost" className="min-h-9 px-3" aria-label={`Dismiss hint for ${hint.original}`} onClick={() => onDismiss(hint)}>
              Dismiss
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}

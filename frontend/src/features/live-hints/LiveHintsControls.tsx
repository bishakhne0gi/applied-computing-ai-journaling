import { useId, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Switch'
import { pluralize } from '@/utils/formatter'
import { HintList } from './HintList'
import type { LiveHint } from './reanchor'

export interface LiveHintsControlsProps {
  on: boolean
  onToggle: (on: boolean) => void
  hints: readonly LiveHint[]
  onAccept: (hint: LiveHint) => void
  onDismiss: (hint: LiveHint) => void
}

export function LiveHintsControls({ on, onToggle, hints, onAccept, onDismiss }: LiveHintsControlsProps) {
  const [expanded, setExpanded] = useState(false)
  const listId = useId()
  const visible = on && hints.length > 0
  const label = pluralize(hints.length, 'hint')
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1">
        <Switch label="Live hints" checked={on} onChange={onToggle} />
        {visible && (
          <Button variant="ghost" className="px-3" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded((open) => !open)}>
            {label}
          </Button>
        )}
        {/* aria-live, not role="status": the composer's save status stays the only status. Checks are debounced, so this is throttled. */}
        <p aria-live="polite" className="sr-only">
          {visible ? label : ''}
        </p>
      </div>
      {visible && expanded && <HintList id={listId} hints={hints} onAccept={onAccept} onDismiss={onDismiss} />}
    </div>
  )
}

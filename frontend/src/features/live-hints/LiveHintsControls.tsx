import { useId, useLayoutEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Switch } from '@/components/ui/Switch'
import { pluralize } from '@/utils/formatter'
import { cn } from '@/utils/utils'
import { HintList } from './HintList'
import type { LiveHint } from './reanchor'

export interface LiveHintsControlsProps {
  on: boolean
  onToggle: (on: boolean) => void
  hints: readonly LiveHint[]
  // Hint count as it settled after the last check, for the screen reader; `hints` follows every keystroke.
  announcement: number
  onAccept: (hint: LiveHint) => void
  onDismiss: (hint: LiveHint) => void
}

export function LiveHintsControls({ on, onToggle, hints, announcement, onAccept, onDismiss }: LiveHintsControlsProps) {
  const [expanded, setExpanded] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  // Where focus goes once the acted-on hint is gone: its neighbour, or the switch when the list empties.
  const focusNext = useRef<string | null>(null)
  const listId = useId()
  const visible = on && hints.length > 0
  if (!visible && expanded) setExpanded(false)
  // Layout effect: applying a hint focuses the text for the undoable edit; moving on in the same task means the text
  // never stays focused (no lingering keyboard on a phone, no announcement of the textarea).
  useLayoutEffect(() => {
    const target = focusNext.current
    if (!target) return
    focusNext.current = null
    const item = Array.from(root.current?.querySelectorAll<HTMLElement>('li[data-hint-id]') ?? []).find((li) => li.dataset.hintId === target)
    const control = item?.querySelector('button') ?? root.current?.querySelector<HTMLElement>('[role="switch"]')
    control?.focus()
  }, [hints])
  const fromList = (hint: LiveHint, act: (hint: LiveHint) => void) => {
    const at = hints.indexOf(hint)
    focusNext.current = (hints[at + 1] ?? hints[at - 1])?.id ?? 'switch'
    act(hint)
  }
  return (
    <div ref={root} className="flex flex-col gap-2">
      <div className="-ml-2 flex flex-wrap items-center gap-1">
        <Switch label="Live hints" checked={on} onChange={onToggle} />
        {visible && (
          <Button variant="ghost" className="gap-1 px-3" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded((open) => !open)}>
            {pluralize(hints.length, 'hint')}
            <Icon name="chevron" className={cn('size-4 transition-transform motion-reduce:transition-none', expanded && 'rotate-180')} />
          </Button>
        )}
        {/* aria-live, not role="status": the composer's save status stays the only status. */}
        <p aria-live="polite" className="sr-only">
          {on && announcement > 0 ? pluralize(announcement, 'hint') : ''}
        </p>
      </div>
      {visible && expanded && <HintList id={listId} hints={hints} onAccept={(hint) => fromList(hint, onAccept)} onDismiss={(hint) => fromList(hint, onDismiss)} />}
    </div>
  )
}

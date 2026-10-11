import { useCallback, useMemo, useState } from 'react'
import type { TextareaEvents } from './EntryTextField'

export interface TextareaSelection {
  start: number
  end: number
  focused: boolean
}

// The single owner of the composer's selection: the rephrase target and (later) the autocomplete read it, nothing else
// mirrors it. It survives blur on purpose, so pressing a button beside the text still rephrases the sentence the caret was in.
export function useTextareaSelection() {
  const [selection, setSelection] = useState<TextareaSelection>({ start: 0, end: 0, focused: false })
  const sync = useCallback((el: HTMLTextAreaElement) => {
    const next = { start: el.selectionStart, end: el.selectionEnd, focused: document.activeElement === el }
    setSelection((prev) => (prev.start === next.start && prev.end === next.end && prev.focused === next.focused ? prev : next))
  }, [])
  const events = useMemo<TextareaEvents>(
    () => ({
      onSelect: (event) => sync(event.currentTarget),
      onKeyUp: (event) => sync(event.currentTarget),
      onClick: (event) => sync(event.currentTarget),
      onFocus: (event) => sync(event.currentTarget),
      onBlur: () => setSelection((prev) => (prev.focused ? { ...prev, focused: false } : prev)),
    }),
    [sync],
  )
  return { selection, sync, events }
}

import { useCallback, useMemo, useState } from 'react'
import type { TextareaEvents } from './EntryTextField'

export interface TextareaSelection {
  start: number
  end: number
  focused: boolean
  dragging: boolean // a mouse button is down on the text: the selection is still being made
}

// The single owner of the composer's selection: the rephrase target and (later) the autocomplete read it, nothing else
// mirrors it. It survives blur on purpose, so pressing a button beside the text still rephrases the sentence the caret was in.
export function useTextareaSelection() {
  const [selection, setSelection] = useState<TextareaSelection>({ start: 0, end: 0, focused: false, dragging: false })
  const sync = useCallback((el: HTMLTextAreaElement) => {
    const next = { start: el.selectionStart, end: el.selectionEnd, focused: document.activeElement === el }
    setSelection((prev) => (prev.start === next.start && prev.end === next.end && prev.focused === next.focused ? prev : { ...next, dragging: prev.dragging }))
  }, [])
  const events = useMemo<TextareaEvents>(
    () => ({
      onPointerDown: (event) => {
        if (event.pointerType !== 'mouse') return
        setSelection((prev) => ({ ...prev, dragging: true }))
        // One-shot and on the document: the button may come up outside the textarea.
        document.addEventListener('pointerup', () => setSelection((prev) => ({ ...prev, dragging: false })), { once: true })
      },
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

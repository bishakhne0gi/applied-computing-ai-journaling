import { useCallback, useState, type FocusEvent, type KeyboardEvent, type MouseEvent, type RefObject, type SyntheticEvent } from 'react'
import { hintAtClick } from './hintAtClick'
import { hintAtCaret, type LiveHint } from './reanchor'

// The popover is passive: it opens under a click that placed the caret, and whatever the writer does next in the text
// (type, move the caret away, leave, press Esc) just closes it. Closing is not dismissing: the hint stays listed.
export function useHintPopover(hints: readonly LiveHint[], textarea: RefObject<HTMLTextAreaElement | null>) {
  const [openId, setOpenId] = useState<string | null>(null)
  const close = useCallback(() => setOpenId(null), [])
  const open = hints.find((hint) => hint.id === openId) ?? null
  const returnToText = () => {
    close()
    textarea.current?.focus()
  }
  const textareaEvents = {
    onClick: (event: MouseEvent<HTMLTextAreaElement>) => setOpenId(hintAtClick(hints, event.currentTarget, { x: event.clientX, y: event.clientY })?.id ?? null),
    onSelect: (event: SyntheticEvent<HTMLTextAreaElement>) => {
      if (openId && hintAtCaret(hints, event.currentTarget)?.id !== openId) close()
    },
    onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== 'Escape' || !open) return
      event.stopPropagation()
      close()
    },
    onBlur: (event: FocusEvent<HTMLTextAreaElement>) => {
      const next = event.relatedTarget
      if (!(next instanceof Element && next.closest('[data-hint-popover]'))) close()
    },
  }
  return { open, close, returnToText, textareaEvents }
}

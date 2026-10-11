import { useCallback, type RefObject } from 'react'
import { bracketRanges } from '@/utils/text'
import { applyHint } from './applyHint'
import { editorDecorations } from './editorDecorations'
import type { LiveHint } from './reanchor'
import { useHintPopover } from './useHintPopover'
import { useLiveHints } from './useLiveHints'
import { useLiveHintsSetting } from './useLiveHintsSetting'

interface Input {
  value: string
  language: string
  readOnly: boolean
  composing: boolean
  textarea: RefObject<HTMLTextAreaElement | null>
}

// The composer's live-hint wiring: checks, the passive popover, accept and dismiss, and the underlines.
export function useComposerHints({ value, language, readOnly, composing, textarea }: Input) {
  const [on, setOn] = useLiveHintsSetting()
  const live = useLiveHints({ text: value, language, enabled: on && !readOnly, composing })
  const { open, close, returnToText, textareaEvents } = useHintPopover(live.hints, textarea)
  const accept = useCallback(
    (hint: LiveHint) => {
      close()
      if (textarea.current) applyHint(textarea.current, hint)
    },
    [close, textarea],
  )
  const dismiss = (hint: LiveHint) => {
    close()
    live.dismiss(hint.key)
  }
  return {
    open,
    close,
    returnToText,
    accept,
    dismiss,
    events: textareaEvents,
    decorations: editorDecorations(bracketRanges(value), live.hints),
    controls: { on, onToggle: setOn, hints: live.hints, announcement: live.announcement, onAccept: accept, onDismiss: dismiss },
  }
}

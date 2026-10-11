import type { KeyboardEvent, RefObject } from 'react'
import type { TextareaEvents } from '@/features/editor/EntryTextField'
import type { TextareaSelection } from '@/features/editor/useTextareaSelection'
import { applyHint } from '@/features/live-hints/applyHint'
import { useMediaQuery } from '@/hooks/misc/useMediaQuery'
import { useAutocomplete } from './useAutocomplete'
import { useAutocompleteSetting } from './useAutocompleteSetting'

interface Input {
  value: string
  language: string
  readOnly: boolean
  composing: boolean
  selection: TextareaSelection
  textarea: RefObject<HTMLTextAreaElement | null>
  // Another surface owns the caret's neighbourhood (the rephrase card): no ghost, no request, behind it.
  suppressed: boolean
}

const plainTab = (event: KeyboardEvent) => event.key === 'Tab' && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey

export function useComposerAutocomplete({ value, language, readOnly, composing, selection, textarea, suppressed }: Input) {
  const [on, setOn] = useAutocompleteSetting()
  // Touch has no Tab key: the ghost is accepted from a button instead. jsdom has no pointer media, hence false.
  const coarse = useMediaQuery('(pointer: coarse)', false)
  // Only at the very end: a ghost anywhere else would push the following lines off the textarea's glyphs.
  const caretAtEnd = selection.focused && selection.start === selection.end && selection.end === value.length
  const auto = useAutocomplete({ value, language, enabled: on && !readOnly && !suppressed, composing, caretAtEnd })
  // The same insertion as Tab, undoable; also what the touch button does.
  const accept = () => {
    if (textarea.current && auto.ghost) applyHint(textarea.current, { start: value.length, end: value.length, correction: auto.ghost })
  }
  const events: TextareaEvents = {
    onKeyDown: (event) => {
      if (!auto.ghost || event.nativeEvent.isComposing) return
      if (plainTab(event)) {
        event.preventDefault()
        accept()
      } else if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation() // the ghost was what Esc meant; nothing else closes with it
        auto.dismiss()
      }
    },
  }
  return { on, onToggle: setOn, accept, coarse, instruction: coarse ? 'Tap Accept suggestion to use the grey text.' : 'Press Tab to accept a grey suggestion.', ghost: auto.ghost, announcement: auto.announcement, events }
}

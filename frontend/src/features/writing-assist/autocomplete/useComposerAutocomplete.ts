import type { KeyboardEvent } from 'react'
import type { TextareaEvents } from '@/features/editor/EntryTextField'
import type { TextareaSelection } from '@/features/editor/useTextareaSelection'
import { applyHint } from '@/features/live-hints/applyHint'
import { useAutocomplete } from './useAutocomplete'
import { useAutocompleteSetting } from './useAutocompleteSetting'

interface Input {
  value: string
  language: string
  readOnly: boolean
  composing: boolean
  selection: TextareaSelection
  // Another surface owns the caret's neighbourhood (the rephrase card): no ghost, no request, behind it.
  suppressed: boolean
}

const plainTab = (event: KeyboardEvent) => event.key === 'Tab' && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey

export function useComposerAutocomplete({ value, language, readOnly, composing, selection, suppressed }: Input) {
  const [on, setOn] = useAutocompleteSetting()
  // Only at the very end: a ghost anywhere else would push the following lines off the textarea's glyphs.
  const caretAtEnd = selection.focused && selection.start === selection.end && selection.end === value.length
  const auto = useAutocomplete({ value, language, enabled: on && !readOnly && !suppressed, composing, caretAtEnd })
  const events: TextareaEvents = {
    onKeyDown: (event) => {
      if (!auto.ghost || event.nativeEvent.isComposing) return
      if (plainTab(event)) {
        event.preventDefault()
        applyHint(event.currentTarget, { start: value.length, end: value.length, correction: auto.ghost })
      } else if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation() // the ghost was what Esc meant; nothing else closes with it
        auto.dismiss()
      }
    },
  }
  return { on, onToggle: setOn, ghost: auto.ghost, announcement: auto.announcement, events }
}

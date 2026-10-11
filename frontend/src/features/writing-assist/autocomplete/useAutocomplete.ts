import { useState } from 'react'
import { useDebouncedValue } from '@/hooks/misc/useDebouncedValue'
import { useCompletionQuery } from '@/hooks/queries/useCompletionQuery'
import type { CompleteOut } from '@/types/assist'
import { AUTOCOMPLETE, MAX_ENTRY_CHARS } from '@/utils/constants'
import { countWords, entryLength } from '@/utils/text'
import { remember } from './seenKeys'
import { visibleGhost, type Answer } from './visibleGhost'

export interface AutocompleteInput {
  value: string
  language: string
  enabled: boolean
  // An open IME composition holds the text half-typed: wait for it instead of completing it.
  composing: boolean
  caretAtEnd: boolean
}

// Read aloud as a sentence of its own: close it unless the suggestion already ends in punctuation.
const sentenceEnd = (text: string) => (/[.!?…]$/u.test(text) ? text : `${text}.`)

// Data exists only for the current key, so it answers exactly the current text. Each query key is shown once, however
// many answers came since: a cached answer for text typed again (an undo) does not come back.
function useAnswer(data: CompleteOut | undefined, key: string, value: string) {
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set())
  const [answer, setAnswer] = useState<Answer | null>(null)
  if (data && !seen.has(key)) {
    setSeen(remember(seen, key))
    setAnswer(data.completion ? { base: value, completion: data.completion } : null)
  }
  return [answer, setAnswer] as const
}

const askable = (value: string, language: string) =>
  language !== '' && countWords(value) >= AUTOCOMPLETE.minWords && entryLength(value) <= MAX_ENTRY_CHARS

// Ghost text only exists for a switched-on composer whose caret is at the end of the text.
const showing = (enabled: boolean, caretAtEnd: boolean, answer: Answer | null, value: string) => (enabled && caretAtEnd ? visibleGhost(answer, value) : '')

export function useAutocomplete({ value, language, enabled, composing, caretAtEnd }: AutocompleteInput) {
  const settled = useDebouncedValue(value, AUTOCOMPLETE.debounceMs, composing)
  // The caret has to rest at the end too: clicking there is not a pause in typing, so it waits as well.
  const caretSettled = useDebouncedValue(caretAtEnd, AUTOCOMPLETE.debounceMs, composing)
  const ready = enabled && !composing && caretAtEnd && caretSettled && settled === value && askable(value, language)
  // Keyed by the text: a keystroke is a new key, and TanStack aborts the superseded request.
  const { data } = useCompletionQuery(ready ? { language, text: value } : null)
  const [answer, setAnswer] = useAnswer(data, `${language}\n${value}`, value)
  const ghost = showing(enabled, caretAtEnd, answer, value)
  if (answer && ghost === '') setAnswer(null)
  return {
    ghost,
    // Derived from the answer, so the polite region speaks once per suggestion, not on every consumed keystroke.
    announcement: answer ? `Suggestion: ${sentenceEnd(answer.completion.trim())} Press Tab to accept.` : '',
    dismiss: () => setAnswer(null),
  }
}

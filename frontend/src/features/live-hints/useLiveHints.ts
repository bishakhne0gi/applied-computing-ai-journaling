import { useMemo, useState } from 'react'
import { useDebouncedValue } from '@/hooks/misc/useDebouncedValue'
import { useCheckQuery } from '@/hooks/queries/useCheckQuery'
import { LIVE_HINTS, MAX_ENTRY_CHARS } from '@/utils/constants'
import { countWords, entryLength } from '@/utils/text'
import { reanchor, type LiveHint } from './reanchor'

export interface LiveHintsInput {
  text: string
  language: string
  enabled: boolean
  // An open IME composition holds the text half-typed: wait for it instead of checking it.
  composing: boolean
}

export function useLiveHints({ text, language, enabled, composing }: LiveHintsInput) {
  const settled = useDebouncedValue(text, LIVE_HINTS.debounceMs, composing)
  const ready = enabled && language !== '' && countWords(settled) >= LIVE_HINTS.minWords && entryLength(settled) <= MAX_ENTRY_CHARS
  const check = useCheckQuery(ready ? { text: settled, language } : null)
  // Dismissed for this composer session: a new entry remounts the composer and starts clean.
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set())
  const hints: LiveHint[] = useMemo(
    () => (ready && !check.isError ? reanchor(check.data, text, dismissed) : []),
    [ready, check.isError, check.data, text, dismissed],
  )
  // Re-anchoring changes the count on keystrokes; the screen reader hears it only once the writer pauses.
  const announcement = useDebouncedValue(hints.length, LIVE_HINTS.debounceMs)
  return { hints, announcement, dismiss: (key: string) => setDismissed((previous) => new Set(previous).add(key)) }
}

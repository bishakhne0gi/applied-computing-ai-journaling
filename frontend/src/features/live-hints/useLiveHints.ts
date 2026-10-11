import { useMemo, useState } from 'react'
import { useDebouncedValue } from '@/hooks/misc/useDebouncedValue'
import { useCheckQuery } from '@/hooks/queries/useCheckQuery'
import { LIVE_HINTS, MAX_ENTRY_CHARS } from '@/utils/constants'
import { countWords, entryLength } from '@/utils/text'
import type { CheckOut } from '@/types/check'
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
  // A failed newer check clears the query's data; the last good answer is still true of the text it was carried
  // across, so it keeps being shown. It is dropped with the request (switch off, too few words).
  const [lastGood, setLastGood] = useState<CheckOut | undefined>(undefined)
  if (check.data && check.data !== lastGood) setLastGood(check.data)
  if (!ready && lastGood) setLastGood(undefined)
  // Dismissed for this composer session: a new entry remounts the composer and starts clean.
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set())
  const hints: LiveHint[] = useMemo(
    () => (ready ? reanchor(check.data ?? lastGood, text, dismissed) : []),
    [ready, check.data, lastGood, text, dismissed],
  )
  // Re-anchoring changes the count on keystrokes; the screen reader hears it only once the writer pauses.
  const announcement = useDebouncedValue(hints.length, LIVE_HINTS.debounceMs)
  return { hints, announcement, dismiss: (key: string) => setDismissed((previous) => new Set(previous).add(key)) }
}

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
}

export function useLiveHints({ text, language, enabled }: LiveHintsInput) {
  const settled = useDebouncedValue(text, LIVE_HINTS.debounceMs)
  const ready = enabled && language !== '' && countWords(settled) >= LIVE_HINTS.minWords && entryLength(settled) <= MAX_ENTRY_CHARS
  const check = useCheckQuery(ready ? { text: settled, language } : null)
  // Dismissed for this composer session: a new entry remounts the composer and starts clean.
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set())
  const hints: LiveHint[] = useMemo(
    () => (ready && !check.isError ? reanchor(check.data, text, dismissed) : []),
    [ready, check.isError, check.data, text, dismissed],
  )
  return { hints, dismiss: (key: string) => setDismissed((previous) => new Set(previous).add(key)) }
}

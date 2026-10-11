import { useId } from 'react'
import { LanguageFiltered } from '@/features/languages/LanguageFiltered'
import { useEntriesQuery } from '@/hooks/queries/useEntriesQuery'
import { FilteredHistory } from './FilteredHistory'

export interface HistoryListProps {
  onStartWriting: () => void
}

// Same query (and cache entry) as the list below, so the count is derived, never stored. "+" while more pages exist.
function EntryCount({ language }: { language: string | null }) {
  const entries = useEntriesQuery(language)
  if (!entries.data) return null
  return (
    <span aria-hidden="true" className="text-sm text-muted tabular-nums">
      {entries.data.length}
      {entries.hasNextPage ? '+' : ''}
    </span>
  )
}

export function HistoryList({ onStartWriting }: HistoryListProps) {
  const id = useId()
  const headingId = useId()
  return (
    <section aria-labelledby={headingId}>
      <LanguageFiltered
        id={id}
        loadingLabel="Loading entries…"
        hideLabel
        header={(language) => (
          <div className="flex items-baseline justify-between gap-2">
            <h2 id={headingId} className="text-sm font-medium text-fg-secondary">
              History
            </h2>
            {language !== undefined && <EntryCount language={language} />}
          </div>
        )}
      >
        {(language) => <FilteredHistory language={language} onStartWriting={onStartWriting} />}
      </LanguageFiltered>
    </section>
  )
}

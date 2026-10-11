import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { LoadingState } from '@/components/ui/LoadingState'
import type { useEntriesQuery } from '@/hooks/queries/useEntriesQuery'
import { toErrorMessage } from '@/utils/errorMessage'
import { pluralize } from '@/utils/formatter'
import { EntryRow } from './EntryRow'
import { LoadMore } from './LoadMore'
import { useFocusNewRows } from './useFocusNewRows'

export interface HistoryResultsProps {
  entries: ReturnType<typeof useEntriesQuery>
  filtered: boolean
  onStartWriting: () => void
}

export function HistoryResults({ entries, filtered, onStartWriting }: HistoryResultsProps) {
  const { listRef, expectRowsAfter } = useFocusNewRows(entries.data?.length ?? 0)
  if (entries.isPending) return <LoadingState label="Loading entries…" />
  // With pages already loaded, a failed "Load more" is reported next to its button instead.
  if (entries.isError && !entries.data) {
    return <ErrorState message={toErrorMessage(entries.error)} onRetry={() => void entries.refetch()} />
  }
  const items = entries.data ?? []
  if (items.length === 0) {
    return (
      <EmptyState title={filtered ? 'No entries in this language yet' : 'No entries yet'}>
        <Button onClick={onStartWriting}>Write your first entry</Button>
      </EmptyState>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <ul ref={listRef} aria-label="Entries" className="-mx-3 flex flex-col gap-1">
        {items.map((entry) => (
          <EntryRow key={entry.id} entry={entry} />
        ))}
      </ul>
      <p role="status" className="text-xs text-muted">
        Showing {pluralize(items.length, 'entry', 'entries')}
      </p>
      <LoadMore
        entries={entries}
        onLoadMore={() => {
          expectRowsAfter(items.length)
          void entries.fetchNextPage()
        }}
      />
    </div>
  )
}

import { Button } from '@/components/ui/Button'
import { InlineAlert } from '@/components/ui/InlineAlert'
import type { useEntriesQuery } from '@/hooks/queries/useEntriesQuery'
import { toErrorMessage } from '@/utils/errorMessage'

export interface LoadMoreProps {
  entries: ReturnType<typeof useEntriesQuery>
  onLoadMore: () => void
}

export function LoadMore({ entries, onLoadMore }: LoadMoreProps) {
  if (!entries.hasNextPage) return null
  return (
    <div className="flex flex-col items-start gap-2">
      {entries.isFetchNextPageError && (
        <InlineAlert>{toErrorMessage(entries.error)}</InlineAlert>
      )}
      <Button onClick={onLoadMore} disabled={entries.isFetchingNextPage}>
        {entries.isFetchingNextPage ? 'Loading…' : 'Load more'}
      </Button>
    </div>
  )
}

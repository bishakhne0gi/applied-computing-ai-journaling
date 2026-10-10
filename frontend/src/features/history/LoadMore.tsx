import { Button } from '@/components/ui/Button'
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
        <p role="alert" className="text-sm text-danger">
          {toErrorMessage(entries.error)}
        </p>
      )}
      <Button onClick={onLoadMore} disabled={entries.isFetchingNextPage}>
        {entries.isFetchingNextPage ? 'Loading…' : 'Load more'}
      </Button>
    </div>
  )
}

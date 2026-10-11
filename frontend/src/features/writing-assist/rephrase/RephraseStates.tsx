import { ErrorState } from '@/components/ui/ErrorState'
import { LoadingState } from '@/components/ui/LoadingState'
import { Skeleton } from '@/components/ui/Skeleton'

export function RephraseLoading() {
  return (
    <LoadingState label="Finding better versions…">
      <Skeleton className="h-14" />
      <Skeleton className="h-14" />
      <Skeleton className="h-14" />
    </LoadingState>
  )
}

export function RephraseError({ onRetry }: { onRetry: () => void }) {
  return <ErrorState message="Rephrasing is unavailable right now." onRetry={onRetry} />
}

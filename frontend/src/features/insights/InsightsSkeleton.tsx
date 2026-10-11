import { LoadingState } from '@/components/ui/LoadingState'
import { Skeleton } from '@/components/ui/Skeleton'

export function InsightsShapes() {
  return (
    <>
      <Skeleton className="h-20" />
      <Skeleton className="h-48" />
    </>
  )
}

// The sheet shows the report's shape from its first frame: while the code loads the filter is a shape too.
export function InsightsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-11 max-w-xs" />
      <LoadingState label="Loading insights…">
        <InsightsShapes />
      </LoadingState>
    </div>
  )
}

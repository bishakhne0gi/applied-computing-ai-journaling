import { ErrorState } from '@/components/ui/ErrorState'
import { LoadingState } from '@/components/ui/LoadingState'
import { Skeleton } from '@/components/ui/Skeleton'
import { entriesToTrends, formatRate } from '@/features/insights/format'
import { TrendBadge } from '@/features/insights/TrendCells'
import { useInsightsQuery } from '@/hooks/queries/useInsightsQuery'
import { toErrorMessage } from '@/utils/errorMessage'
import { pluralize } from '@/utils/formatter'
import { Sparkline } from './Sparkline'

const RECENT_POINTS = 10

export function ProgressLoading() {
  return (
    <LoadingState label="Loading progress…">
      <Skeleton className="h-10" />
      <Skeleton className="h-5 w-2/3" />
    </LoadingState>
  )
}

export function ProgressSummary({ language }: { language: string | null }) {
  const insights = useInsightsQuery(language)
  const { data } = insights
  if (!data) {
    if (insights.isError) return <ErrorState message={toErrorMessage(insights.error)} onRetry={() => void insights.refetch()} />
    return <ProgressLoading />
  }
  if (data.status !== 'trends') {
    const missing = entriesToTrends(data.entry_count)
    return <p className="text-sm text-muted">{`${pluralize(missing, 'more entry', 'more entries')} to see trends`}</p>
  }
  return (
    <div className="flex flex-col gap-2">
      <Sparkline points={data.points.slice(-RECENT_POINTS)} trend={data.trend} />
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <TrendBadge trend={data.trend} />
        <span className="text-fg-secondary tabular-nums">{`${formatRate(data.error_rate)} per 100 words`}</span>
      </p>
    </div>
  )
}

import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { LoadingState } from '@/components/ui/LoadingState'
import { Skeleton } from '@/components/ui/Skeleton'
import { TextLink } from '@/components/ui/TextLink'
import { useInsightsQuery } from '@/hooks/queries/useInsightsQuery'
import { toErrorMessage } from '@/utils/errorMessage'
import { InsightsReport } from './InsightsReport'

export interface InsightsResultsProps {
  language: string | null
}

export function InsightsResults({ language }: InsightsResultsProps) {
  const insights = useInsightsQuery(language)
  const { data } = insights
  // Cached insights outrank a failed background refresh, as in History.
  if (!data) {
    if (insights.isError) return <ErrorState message={toErrorMessage(insights.error)} onRetry={() => void insights.refetch()} />
    return (
      <LoadingState label="Loading insights…">
        <Skeleton className="h-20" />
        <Skeleton className="h-48" />
      </LoadingState>
    )
  }
  if (data.status === 'insufficient_data') {
    return (
      <EmptyState title="Not enough entries yet">
        <p className="text-sm text-muted">{data.summary[0]}</p>
        <TextLink to="/">Write an entry</TextLink>
      </EmptyState>
    )
  }
  return <InsightsReport insights={data} />
}

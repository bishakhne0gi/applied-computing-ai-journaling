import type { InsightsOut } from '@/types/insights'
import { CategoryTable } from './CategoryTable'
import { entriesToTrends } from './format'
import { RateChart } from './RateChart'

export interface InsightsReportProps {
  insights: InsightsOut
}

export function InsightsReport({ insights }: InsightsReportProps) {
  return (
    <div className="flex flex-col gap-8">
      <RateChart points={insights.points} trend={insights.trend} />
      {/* The server's last summary sentence is the "trends start at N" note; the other bullets repeat the chart and table. */}
      {insights.status === 'totals_only' && <p className="text-muted">{insights.summary.at(-1)}</p>}
      {insights.categories.length > 0 ? (
        <CategoryTable
          categories={insights.categories}
          recurringWindow={insights.recurring_window}
          totalWords={insights.total_words}
          entriesToTrends={insights.status === 'trends' ? 0 : entriesToTrends(insights.entry_count)}
        />
      ) : (
        <p className="text-muted">No errors in these entries, so nothing to work on yet.</p>
      )}
    </div>
  )
}

import { SectionHeading } from '@/components/ui/SectionHeading'
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
      <section aria-labelledby="insights-summary" className="flex flex-col gap-2">
        <SectionHeading id="insights-summary">Summary</SectionHeading>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {insights.summary.map((sentence, index) => (
            <li key={index}>{sentence}</li>
          ))}
        </ul>
      </section>
      <RateChart points={insights.points} trend={insights.trend} />
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

import type { InsightsOut } from '@/types/insights'
import { CategoryTable } from './CategoryTable'
import { RateChart } from './RateChart'

export interface InsightsReportProps {
  insights: InsightsOut
}

export function InsightsReport({ insights }: InsightsReportProps) {
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="insights-summary" className="flex flex-col gap-2">
        <h2 id="insights-summary" className="text-lg font-semibold">
          Summary
        </h2>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {insights.summary.map((sentence) => (
            <li key={sentence}>{sentence}</li>
          ))}
        </ul>
      </section>
      <RateChart points={insights.points} trend={insights.trend} />
      {insights.categories.length > 0 ? (
        <CategoryTable categories={insights.categories} recurringWindow={insights.recurring_window} />
      ) : (
        <p className="text-muted">No errors in these entries — nothing to work on yet.</p>
      )}
    </div>
  )
}

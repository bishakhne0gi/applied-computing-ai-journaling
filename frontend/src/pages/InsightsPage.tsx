import { PageHeading } from '@/components/ui/PageHeading'
import { InsightsScreen } from '@/features/insights/InsightsScreen'

export function InsightsPage() {
  return (
    <div className="flex flex-col gap-6">
      <title>Insights · Language Journal</title>
      <div className="flex flex-col gap-1">
        <PageHeading>Insights</PageHeading>
        <p className="text-muted">How your errors change as you write. Suggestions and word help don’t count.</p>
      </div>
      <InsightsScreen />
    </div>
  )
}

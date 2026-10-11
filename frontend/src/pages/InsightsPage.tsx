import { PageHeading } from '@/components/ui/PageHeading'
import { TextLink } from '@/components/ui/TextLink'
import { InsightsScreen } from '@/features/insights/InsightsScreen'

export function InsightsPage() {
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex max-w-content flex-col gap-6 px-4 py-6">
      <title>Insights · Language Journal</title>
      <TextLink to="/">Back to your journal</TextLink>
      <div className="flex flex-col gap-1">
        <PageHeading>Insights</PageHeading>
        <p className="text-muted">How your errors change as you write. Suggestions and word help don’t count.</p>
      </div>
      <InsightsScreen />
    </main>
  )
}

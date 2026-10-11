import { lazy, Suspense, useState } from 'react'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { ErrorState } from '@/components/ui/ErrorState'
import { Sheet } from '@/components/ui/Sheet'
import { InsightsSkeleton } from '@/features/insights/InsightsSkeleton'
import { useMediaQuery } from '@/hooks/misc/useMediaQuery'
import { useWorkspaceParams } from '@/hooks/misc/useWorkspaceParams'
import { DESKTOP_QUERY } from '@/utils/constants'
import { loadInsightsScreen } from './loadInsightsScreen'

// The shell opens at once (focus moves in, the opener is recorded); only the report and its charts are code-split.
function InsightsContent() {
  // React caches a rejected lazy import, so a retry needs a fresh one.
  const [Screen, setScreen] = useState(() => lazy(loadInsightsScreen))
  return (
    <ErrorBoundary
      onRetry={() => setScreen(() => lazy(loadInsightsScreen))}
      fallback={(retry) => <ErrorState message="Insights didn’t load. Check your connection and try again." onRetry={retry} />}
    >
      <Suspense fallback={<InsightsSkeleton />}>
        <Screen />
      </Suspense>
    </ErrorBoundary>
  )
}

// A layer over the workspace, never a place: closing it lands exactly where the learner was.
export function InsightsSheet() {
  const { insightsOpen, closeInsights } = useWorkspaceParams()
  const desktop = useMediaQuery(DESKTOP_QUERY, true)
  return (
    <Sheet
      open={insightsOpen}
      onClose={closeInsights}
      side={desktop ? 'right' : 'bottom'}
      title="Insights"
      description="How your errors change as you write. Suggestions and word help don’t count."
    >
      <InsightsContent />
    </Sheet>
  )
}

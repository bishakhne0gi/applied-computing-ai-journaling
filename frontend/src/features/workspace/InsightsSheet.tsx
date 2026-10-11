import { Sheet } from '@/components/ui/Sheet'
import { InsightsScreen } from '@/features/insights/InsightsScreen'
import { useMediaQuery } from '@/hooks/misc/useMediaQuery'
import { useWorkspaceParams } from '@/hooks/misc/useWorkspaceParams'
import { DESKTOP_QUERY } from '@/utils/constants'

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
      <InsightsScreen />
    </Sheet>
  )
}

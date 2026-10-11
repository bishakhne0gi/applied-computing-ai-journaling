import { useId } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { useLanguageFilter } from '@/features/languages/useLanguageFilter'
import { ProgressLoading, ProgressSummary } from './ProgressSummary'

export interface ProgressCardProps {
  onOpenInsights: () => void
}

// Same query and filter as the insights sheet, so opening it shows the same numbers instantly from the cache.
export function ProgressCard({ onOpenInsights }: ProgressCardProps) {
  const headingId = useId()
  const filter = useLanguageFilter()
  return (
    <Card as="section" aria-labelledby={headingId} className="flex flex-col gap-3 bg-bg p-4 shadow-none">
      <h2 id={headingId} className="text-sm font-medium text-fg-secondary">
        Progress
      </h2>
      {filter.state === 'ready' && <ProgressSummary language={filter.language} />}
      {filter.state === 'pending' && <ProgressLoading />}
      <Button onClick={onOpenInsights}>
        <Icon name="chart" />
        Open insights
      </Button>
    </Card>
  )
}

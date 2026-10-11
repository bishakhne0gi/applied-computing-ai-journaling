import { ChartTooltipCard } from '@/components/ui/Chart'
import type { RatePointOut } from '@/types/insights'
import { formatDateTime, pluralize } from '@/utils/formatter'
import { formatRate } from './format'

export interface RateTooltipProps {
  points: RatePointOut[]
  // recharts injects these into the element passed as `content`.
  active?: boolean
  payload?: { payload?: { index?: number } }[]
}

export function RateTooltip({ points, active, payload }: RateTooltipProps) {
  const index = payload?.[0]?.payload?.index
  const point = active && index !== undefined ? points[index] : undefined
  if (!point) return null
  return (
    <ChartTooltipCard title={formatDateTime(point.created_at)}>
      <span className="text-fg-secondary">{`${formatRate(point.rate)} per 100 words`}</span>
      <span className="text-muted">{`${pluralize(point.error_count, 'error')} in ${pluralize(point.word_count, 'word')}`}</span>
    </ChartTooltipCard>
  )
}

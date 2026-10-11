import { CHART } from '@/features/insights/chartGeometry'
import { describeRates } from '@/features/insights/format'
import { RateLines } from '@/features/insights/RateLines'
import type { RatePointOut, Trend } from '@/types/insights'

export interface SparklineProps {
  points: RatePointOut[]
  trend: Trend | null
}

// Same geometry as the insights chart, squashed to a strip; the label says the numbers for screen readers.
export function Sparkline({ points, trend }: SparklineProps) {
  return (
    <svg role="img" aria-label={describeRates(points, trend)} viewBox={`0 0 ${CHART.width} ${CHART.height}`} preserveAspectRatio="none" className="h-10 w-full overflow-visible">
      <RateLines points={points} />
    </svg>
  )
}

import { CHART, plotRuns } from '@/features/insights/chartGeometry'
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
      {/* A zero-length round-capped line is a dot that keeps its shape when the strip is squashed (a circle would not). */}
      {plotRuns(points)
        .filter((run) => run.length === 1)
        .map(([only]) => (
          <line key={only?.id} data-dot x1={only?.x} x2={only?.x} y1={only?.y} y2={only?.y} strokeLinecap="round" vectorEffect="non-scaling-stroke" className="stroke-primary stroke-6" />
        ))}
    </svg>
  )
}

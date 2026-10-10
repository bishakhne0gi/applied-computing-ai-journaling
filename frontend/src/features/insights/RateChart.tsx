import type { RatePointOut, Trend } from '@/types/insights'
import { formatDate } from '@/utils/formatter'
import { CHART, highestRate, plotRates, plotRuns, polylinePoints } from './chartGeometry'
import { describeRates, formatRate } from './format'
import { RateTable } from './RateTable'

export interface RateChartProps {
  points: RatePointOut[]
  trend: Trend | null
}

const baseline = CHART.height - CHART.inset

// No chart library (spec §7). The SVG is one labelled image; RateTable carries the numbers for screen readers,
// so the visible axis labels are hidden from them to avoid reading everything twice.
export function RateChart({ points, trend }: RateChartProps) {
  const plotted = plotRates(points)
  const runs = plotRuns(points)
  const first = points[0]
  const last = points.at(-1)
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="font-medium">Errors per 100 words, oldest entry to newest</figcaption>
      <p aria-hidden="true" className="flex justify-between text-xs text-muted">
        <span>Highest: {formatRate(highestRate(points))}</span>
        <span>Baseline: 0</span>
      </p>
      <svg role="img" aria-label={describeRates(points, trend)} viewBox={`0 0 ${CHART.width} ${CHART.height}`} className="h-auto w-full overflow-visible">
        <line x1={CHART.inset} x2={CHART.width - CHART.inset} y1={baseline} y2={baseline} vectorEffect="non-scaling-stroke" className="stroke-border stroke-1" />
        {runs
          .filter((run) => run.length > 1)
          .map((run) => (
            <polyline key={run[0]?.id} points={polylinePoints(run)} strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="fill-none stroke-primary stroke-2" />
          ))}
        {plotted.map((point) => (
          <circle key={point.id} cx={point.x} cy={point.y} r={5} className="fill-primary" />
        ))}
      </svg>
      <div aria-hidden="true" className="flex justify-between text-xs text-muted">
        <span>{first ? formatDate(first.created_at) : ''}</span>
        <span>{last ? formatDate(last.created_at) : ''}</span>
      </div>
      <RateTable points={points} />
    </figure>
  )
}

import { useState, type PointerEvent } from 'react'
import type { RatePointOut, Trend } from '@/types/insights'
import { cn } from '@/utils/utils'
import { YAxis, XTicks } from './ChartAxes'
import { ChartReadout } from './ChartReadout'
import { CHART, highestRate, nearestIndex, niceTop, plotRates, xAt } from './chartGeometry'
import { describeRates } from './format'
import { RateLines } from './RateLines'
import { RateTable } from './RateTable'

export interface RateChartProps {
  points: RatePointOut[]
  trend: Trend | null
}

const GRIDLINES = [0, CHART.height / 2]

// No chart library (spec §7). The SVG is one labelled image; RateTable carries the numbers for screen readers, so the
// axis labels and the readout are hidden from them to avoid reading everything twice. Hovering (or touching) the
// plot moves the readout to the nearest entry; without a pointer it shows the latest one.
export function RateChart({ points, trend }: RateChartProps) {
  const [active, setActive] = useState<number | null>(null)
  const index = active ?? points.length - 1
  const shown = points[index]
  const plotted = plotRates(points)
  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    if (box.width > 0) setActive(nearestIndex((event.clientX - box.left) / box.width, points.length))
  }
  return (
    <figure className="flex flex-col gap-4">
      <figcaption className="font-medium">Errors per 100 words, oldest entry to newest</figcaption>
      {shown && <ChartReadout point={shown} position={active === null ? null : { index: active, count: points.length }} />}
      <div className="flex gap-3">
        <YAxis top={niceTop(highestRate(points))} />
        <svg
          role="img"
          aria-label={describeRates(points, trend)}
          viewBox={`0 0 ${CHART.width} ${CHART.height}`}
          className="h-auto min-w-0 flex-1 touch-pan-y overflow-visible"
          onPointerMove={onPointerMove}
          onPointerLeave={() => setActive(null)}
        >
          {GRIDLINES.map((y) => (
            <line key={y} x1={0} x2={CHART.width} y1={y} y2={y} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" className="stroke-border stroke-1" />
          ))}
          <line x1={0} x2={CHART.width} y1={CHART.height} y2={CHART.height} vectorEffect="non-scaling-stroke" className="stroke-border-input stroke-1" />
          <RateLines points={points} filled />
          {active !== null && (
            <line data-guide x1={xAt(active, points.length)} x2={xAt(active, points.length)} y1={0} y2={CHART.height} vectorEffect="non-scaling-stroke" className="stroke-muted stroke-1" />
          )}
          {plotted.map((point) => {
            const current = point.id === shown?.entry_id
            return <circle key={point.id} cx={point.x} cy={point.y} r={current ? 6 : 4} className={cn('fill-primary', current && 'stroke-bg stroke-2')} />
          })}
        </svg>
      </div>
      <div className="flex gap-3">
        <span className="w-8 shrink-0" />
        <div className="min-w-0 flex-1">
          <XTicks points={points} />
        </div>
      </div>
      <RateTable points={points} />
    </figure>
  )
}

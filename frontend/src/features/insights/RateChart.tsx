import { useId } from 'react'
import { useReducedMotion } from 'motion/react'
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartContainer, chartAnimation } from '@/components/ui/Chart'
import type { RatePointOut, Trend } from '@/types/insights'
import { formatShortDateTime } from '@/utils/formatter'
import { ChartReadout } from './ChartReadout'
import { describeRates } from './format'
import { RateTable } from './RateTable'
import { RateTooltip } from './RateTooltip'

export interface RateChartProps {
  points: RatePointOut[]
  trend: Trend | null
}

// recharts is the shadcn chart's engine. The drawing is one labelled image (aria-hidden inside); RateTable carries the
// numbers for screen readers, so the readout is hidden from them too. A null rate leaves a gap in the line.
export function RateChart({ points, trend }: RateChartProps) {
  const reduce = useReducedMotion() ?? false
  const gradientId = useId()
  const latest = points.at(-1)
  const data = points.map((point, index) => ({ index, rate: point.rate, label: formatShortDateTime(point.created_at) }))
  return (
    <figure className="flex flex-col gap-4">
      <figcaption className="font-medium">Errors per 100 words, oldest entry to newest</figcaption>
      {latest && <ChartReadout point={latest} />}
      <ChartContainer label={describeRates(points, trend)}>
        <AreaChart accessibilityLayer={false} data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="4 4" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis width={32} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip cursor={{ strokeDasharray: '4 4' }} isAnimationActive={false} content={<RateTooltip points={points} />} />
          <Area
            type="monotone"
            dataKey="rate"
            stroke="var(--color-primary)"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={{ r: 3, fill: 'var(--color-primary)' }}
            {...chartAnimation(reduce)}
          />
        </AreaChart>
      </ChartContainer>
      <RateTable points={points} />
    </figure>
  )
}

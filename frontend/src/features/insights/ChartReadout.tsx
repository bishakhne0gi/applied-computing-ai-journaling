import type { RatePointOut } from '@/types/insights'
import { formatDateTime, pluralize } from '@/utils/formatter'
import { formatRate } from './format'

export interface ChartReadoutProps {
  point: RatePointOut
  // Null when nothing is hovered: the readout then shows the latest entry.
  position: { index: number; count: number } | null
}

// The numbers for one entry, above the plot (like a dashboard chart's header) instead of a floating tooltip. Hidden
// from screen readers: RateTable already lists every entry.
export function ChartReadout({ point, position }: ChartReadoutProps) {
  return (
    <div aria-hidden="true" className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <div className="flex flex-col">
        <span className="text-xs text-muted">{position ? `Entry ${position.index + 1} of ${position.count}` : 'Latest entry'}</span>
        <span className="text-sm text-fg-secondary">{formatDateTime(point.created_at)}</span>
        <span className="text-xs text-muted">{`${pluralize(point.error_count, 'error')} in ${pluralize(point.word_count, 'word')}`}</span>
      </div>
      <p className="flex items-baseline gap-1.5">
        <span className="text-2xl font-light tracking-tight text-fg tabular-nums">{formatRate(point.rate)}</span>
        {point.rate !== null && <span className="text-sm text-muted">per 100 words</span>}
      </p>
    </div>
  )
}

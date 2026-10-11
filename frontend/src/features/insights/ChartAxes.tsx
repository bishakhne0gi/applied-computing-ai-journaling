import type { RatePointOut } from '@/types/insights'
import { formatMonthDay, formatTime } from '@/utils/formatter'
import { cn } from '@/utils/utils'
import { tickIndices } from './chartGeometry'

const formatTick = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1))

// Beside the plot, one label per gridline (top, half, zero), each centred on its line.
export function YAxis({ top }: { top: number }) {
  return (
    <div aria-hidden="true" className="flex w-8 shrink-0 flex-col justify-between text-right text-xs text-muted tabular-nums">
      {[top, top / 2, 0].map((value) => (
        <span key={value} className="-translate-y-1/2 last:translate-y-1/2">
          {formatTick(value)}
        </span>
      ))}
    </div>
  )
}

function slotAlign(index: number, last: number): string {
  if (last === 0) return 'justify-center'
  if (index === 0) return 'justify-start'
  return index === last ? 'justify-end' : 'justify-center'
}

// One zero-width slot per entry, spread like the points, so a label sits exactly under its dot; the end labels lean
// inwards so they never hang past the plot. Date and time: two entries on one day stay tellable apart.
export function XTicks({ points }: { points: RatePointOut[] }) {
  const shown = new Set(tickIndices(points.length))
  const last = points.length - 1
  return (
    <div aria-hidden="true" className={cn('flex text-xs text-muted', points.length > 1 ? 'justify-between' : 'justify-center')}>
      {points.map((point, index) => (
        <span key={point.entry_id} className={cn('flex w-0', slotAlign(index, last))}>
          {shown.has(index) && (
            <span className="flex flex-col whitespace-nowrap">
              <span className="text-fg-secondary">{formatMonthDay(point.created_at)}</span>
              <span>{formatTime(point.created_at)}</span>
            </span>
          )}
        </span>
      ))}
    </div>
  )
}

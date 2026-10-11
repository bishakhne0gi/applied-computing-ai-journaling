import { Badge, type BadgeProps } from '@/components/ui/Badge'
import type { Trend } from '@/types/insights'
import { pluralize } from '@/utils/formatter'
import { formatRate, TREND_TEXT } from './format'

const TONES = { improving: 'success', stable: 'neutral', worsening: 'danger' } as const satisfies Record<Trend, BadgeProps['tone']>
const ARROWS: Record<Trend, string> = { improving: '↓', stable: '→', worsening: '↑' }

export function RateChange({ earlier, recent }: { earlier: number | null; recent: number | null }) {
  // Only a window without words has no rate; say so in words rather than leave a dash.
  if (earlier === null || recent === null) return <span className="text-muted">Not measured</span>
  return (
    <>
      {formatRate(earlier)} <span aria-hidden="true">→</span>
      <span className="sr-only">to</span> {formatRate(recent)}
    </>
  )
}

// Before trends exist the cell says when they will, instead of an empty mark.
export function TrendPending({ entriesLeft }: { entriesLeft: number }) {
  return <span className="text-muted">{`After ${pluralize(entriesLeft, 'more entry', 'more entries')}`}</span>
}

// The arrow is decoration: the word carries the meaning for screen readers and for anyone who can't tell the tones apart.
export function TrendBadge({ trend }: { trend: Trend | null }) {
  if (trend === null) return <span className="text-muted">Not measured</span>
  return (
    <Badge tone={TONES[trend]} className="whitespace-nowrap">
      <span aria-hidden="true">{ARROWS[trend]}</span>&nbsp;{TREND_TEXT[trend]}
    </Badge>
  )
}

import { Badge, type BadgeProps } from '@/components/ui/Badge'
import type { Trend } from '@/types/insights'
import { formatRate, TREND_TEXT } from './format'

const TONES = { improving: 'success', stable: 'neutral', worsening: 'danger' } as const satisfies Record<Trend, BadgeProps['tone']>
const ARROWS: Record<Trend, string> = { improving: '↓', stable: '→', worsening: '↑' }

function NotYet() {
  return (
    <span className="text-muted">
      <span aria-hidden="true">—</span>
      <span className="sr-only">Not enough entries yet</span>
    </span>
  )
}

export function RateChange({ earlier, recent }: { earlier: number | null; recent: number | null }) {
  if (earlier === null || recent === null) return <NotYet />
  return (
    <>
      {formatRate(earlier)} <span aria-hidden="true">→</span>
      <span className="sr-only">to</span> {formatRate(recent)}
    </>
  )
}

// The arrow is decoration: the word carries the meaning for screen readers and for anyone who can't tell the tones apart.
export function TrendBadge({ trend }: { trend: Trend | null }) {
  if (trend === null) return <NotYet />
  return (
    <Badge tone={TONES[trend]}>
      <span aria-hidden="true">{ARROWS[trend]}</span>&nbsp;{TREND_TEXT[trend]}
    </Badge>
  )
}

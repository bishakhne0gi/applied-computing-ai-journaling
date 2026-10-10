import type { RatePointOut, Trend } from '@/types/insights'
import { pluralize } from '@/utils/formatter'

export const TREND_TEXT: Record<Trend, string> = { improving: 'Improving', stable: 'Steady', worsening: 'Getting worse' }

// The API already rounds to one decimal; toFixed only pads "2" to "2.0".
export function formatRate(rate: number | null): string {
  return rate === null ? '—' : rate.toFixed(1)
}

export function describeRates(points: RatePointOut[], trend: Trend | null): string {
  const rates = points.flatMap((point) => (point.rate === null ? [] : [point.rate]))
  const latest = rates.at(-1)
  const range =
    latest === undefined
      ? 'no words to measure'
      : `lowest ${formatRate(Math.min(...rates))}, highest ${formatRate(Math.max(...rates))}, latest ${formatRate(latest)}`
  const overall = trend ? ` Overall: ${TREND_TEXT[trend].toLowerCase()}.` : ''
  return `Errors per 100 words across ${pluralize(points.length, 'entry', 'entries')}, oldest to newest: ${range}.${overall}`
}

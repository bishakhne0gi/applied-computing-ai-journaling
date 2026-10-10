import type { RatePointOut } from '@/types/insights'

export const CHART = { width: 640, height: 200, inset: 8 } as const

export interface PlottedPoint {
  id: string
  x: number
  y: number
}

export function highestRate(points: RatePointOut[]): number {
  return Math.max(0, ...points.map((point) => point.rate ?? 0))
}

// Spaced by entry, not by date: the windows count entries, and a week off writing would squash the rest together.
export function plotRates(points: RatePointOut[]): PlottedPoint[] {
  const top = highestRate(points) || 1
  const step = points.length > 1 ? (CHART.width - 2 * CHART.inset) / (points.length - 1) : 0
  const plotHeight = CHART.height - 2 * CHART.inset
  return points.flatMap((point, index) => {
    if (point.rate === null) return []
    const x = points.length > 1 ? CHART.inset + index * step : CHART.width / 2
    return [{ id: point.entry_id, x, y: CHART.height - CHART.inset - (point.rate / top) * plotHeight }]
  })
}

export function polylinePoints(plotted: PlottedPoint[]): string {
  return plotted.map((point) => `${point.x},${point.y}`).join(' ')
}

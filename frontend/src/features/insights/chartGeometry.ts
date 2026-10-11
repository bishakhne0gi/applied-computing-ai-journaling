import type { RatePointOut } from '@/types/insights'

// No inset: the plot spans the whole box so HTML axis labels beside and below it line up with the gridlines and
// points; the SVG is overflow-visible, so dots on the edges are never clipped.
export const CHART = { width: 640, height: 200 } as const

export interface PlottedPoint {
  id: string
  x: number
  y: number
}

export function highestRate(points: RatePointOut[]): number {
  return Math.max(0, ...points.map((point) => point.rate ?? 0))
}

// The axis top rounds up to 1, 2, 2.5 or 5 times a power of ten, so the gridline labels read as round numbers.
export function niceTop(highest: number): number {
  if (highest <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(highest))
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= highest) ?? 10
  return step * magnitude
}

function xAt(index: number, count: number): number {
  return count > 1 ? (index * CHART.width) / (count - 1) : CHART.width / 2
}

// Spaced by entry, not by date: the windows count entries, and a week off writing would squash the rest together.
export function plotRates(points: RatePointOut[]): PlottedPoint[] {
  const top = niceTop(highestRate(points))
  return points.flatMap((point, index) => {
    if (point.rate === null) return []
    return [{ id: point.entry_id, x: xAt(index, points.length), y: CHART.height - (point.rate / top) * CHART.height }]
  })
}

export function polylinePoints(plotted: PlottedPoint[]): string {
  return plotted.map((point) => `${point.x},${point.y}`).join(' ')
}

// A null rate means "not measured", not zero: the line stops there rather than bridging two real readings.
export function plotRuns(points: RatePointOut[]): PlottedPoint[][] {
  const plotted = new Map(plotRates(points).map((point) => [point.id, point]))
  const runs: PlottedPoint[][] = []
  let open = false
  for (const entry of points) {
    const point = plotted.get(entry.entry_id)
    if (!point) open = false
    else if (open) runs.at(-1)?.push(point)
    else {
      runs.push([point])
      open = true
    }
  }
  return runs
}

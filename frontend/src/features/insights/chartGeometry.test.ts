import { describe, expect, it } from 'vitest'
import type { RatePointOut } from '@/types/insights'
import { areaPoints, CHART, highestRate, nearestIndex, niceTop, plotRates, plotRuns, polylinePoints, tickIndices } from './chartGeometry'

const points = (...rates: (number | null)[]): RatePointOut[] =>
  rates.map((rate, index) => ({ entry_id: `e${index}`, created_at: '2026-10-09T18:00:00Z', word_count: 10, error_count: 1, rate }))

describe('chart geometry', () => {
  it('spaces entries evenly across the full width and scales rates to a round axis top', () => {
    // Arrange
    const rates = points(0, 5, 8)
    // Act
    const plotted = plotRates(rates)
    // Assert: the top is 10, so 5 sits halfway up and 8 at 80%.
    expect(plotted.map(({ x, y }) => [x, y])).toEqual([
      [0, 200],
      [320, 100],
      [CHART.width, 40],
    ])
  })

  it('keeps an all-zero line on the baseline instead of dividing by zero', () => {
    // Arrange
    const rates = points(0, 0, 0)
    // Act
    const line = polylinePoints(plotRates(rates))
    // Assert
    expect(line).toBe('0,200 320,200 640,200')
  })

  it('keeps the other entries in place when one has no rate', () => {
    // Arrange
    const rates = points(1, null, 2)
    // Act
    const plotted = plotRates(rates)
    // Assert
    expect(plotted.map((point) => [point.id, point.x])).toEqual([
      ['e0', 0],
      ['e2', 640],
    ])
  })

  it('splits the line into runs at every unmeasured entry', () => {
    // Arrange
    const rates = points(1, 2, null, 3, null, 4, 5)
    // Act
    const runs = plotRuns(rates)
    // Assert
    expect(runs.map((run) => run.map((point) => point.id))).toEqual([['e0', 'e1'], ['e3'], ['e5', 'e6']])
  })

  it('has no runs when nothing was measured', () => {
    // Arrange + Act + Assert
    expect(plotRuns(points(null, null))).toEqual([])
  })

  it('centres a single entry', () => {
    // Arrange
    const rates = points(3)
    // Act
    const [only] = plotRates(rates)
    // Assert
    expect(only?.x).toBe(CHART.width / 2)
  })

  it('reports the highest rate, or zero when nothing was measured', () => {
    // Arrange
    const measured = points(1.5, 4.2, null)
    // Act + Assert
    expect(highestRate(measured)).toBe(4.2)
    expect(highestRate(points(null))).toBe(0)
  })

  it('rounds the axis top up to 1, 2, 2.5 or 5 times a power of ten', () => {
    // Arrange + Act + Assert
    expect([0, 0.4, 3, 7.6, 9.1, 20, 21, 240].map(niceTop)).toEqual([1, 0.5, 5, 10, 10, 20, 25, 250])
  })

  it('closes a run down to the baseline for the area under it', () => {
    // Arrange
    const run = plotRates(points(5, 10))
    // Act + Assert
    expect(areaPoints(run)).toBe('0,200 0,100 640,0 640,200')
    expect(areaPoints([])).toBe('')
  })

  it('labels every entry when they fit, otherwise spreads labels evenly including both ends', () => {
    // Arrange + Act + Assert
    expect(tickIndices(3)).toEqual([0, 1, 2])
    expect(tickIndices(11)).toEqual([0, 3, 7, 10])
  })

  it('finds the entry nearest a pointer position and clamps outside the plot', () => {
    // Arrange + Act + Assert
    expect(nearestIndex(0.49, 3)).toBe(1)
    expect(nearestIndex(-0.2, 3)).toBe(0)
    expect(nearestIndex(1.4, 3)).toBe(2)
    expect(nearestIndex(0.7, 1)).toBe(0)
  })
})

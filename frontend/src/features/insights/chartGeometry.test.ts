import { describe, expect, it } from 'vitest'
import type { RatePointOut } from '@/types/insights'
import { CHART, highestRate, plotRates, plotRuns, polylinePoints } from './chartGeometry'

const points = (...rates: (number | null)[]): RatePointOut[] =>
  rates.map((rate, index) => ({ entry_id: `e${index}`, created_at: '2026-10-09T18:00:00Z', word_count: 10, error_count: 1, rate }))

describe('chart geometry', () => {
  it('spaces entries evenly and puts the highest rate at the top', () => {
    // Arrange
    const rates = points(0, 5, 10)
    // Act
    const plotted = plotRates(rates)
    // Assert
    expect(plotted.map(({ x, y }) => [x, y])).toEqual([
      [CHART.inset, 192],
      [320, 100],
      [CHART.width - CHART.inset, CHART.inset],
    ])
  })

  it('keeps an all-zero line on the baseline instead of dividing by zero', () => {
    // Arrange
    const rates = points(0, 0, 0)
    // Act
    const line = polylinePoints(plotRates(rates))
    // Assert
    expect(line).toBe('8,192 320,192 632,192')
  })

  it('keeps the other entries in place when one has no rate', () => {
    // Arrange
    const rates = points(1, null, 2)
    // Act
    const plotted = plotRates(rates)
    // Assert
    expect(plotted.map((point) => [point.id, point.x])).toEqual([
      ['e0', 8],
      ['e2', 632],
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
})

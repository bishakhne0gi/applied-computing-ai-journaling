import { describe, expect, it } from 'vitest'
import type { RatePointOut } from '@/types/insights'
import { CHART, highestRate, plotRates, polylinePoints } from './chartGeometry'

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

  it('leaves a gap for an entry without a rate but keeps the others in place', () => {
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

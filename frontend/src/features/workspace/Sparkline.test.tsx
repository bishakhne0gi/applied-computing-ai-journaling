import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { RatePointOut } from '@/types/insights'
import { Sparkline } from './Sparkline'

const point = (n: number, rate: number | null): RatePointOut => ({
  entry_id: `e${n}`,
  created_at: '2026-10-01T00:00:00Z',
  word_count: 50,
  error_count: 1,
  rate,
})

const draw = (rates: (number | null)[]) => render(<Sparkline points={rates.map((rate, n) => point(n, rate))} trend="stable" />).container

describe('Sparkline', () => {
  it('draws one line through consecutive measured points', () => {
    // Arrange + Act
    const container = draw([4, 6, 5])
    // Assert
    expect(container.querySelectorAll('polyline')).toHaveLength(1)
  })

  it('breaks the line at an unmeasured entry', () => {
    // Arrange + Act
    const container = draw([4, 6, null, 3, 2])
    // Assert
    expect(container.querySelectorAll('polyline')).toHaveLength(2)
  })

  it('marks a lone measured point with a dot, since a one-point line is invisible', () => {
    // Arrange + Act
    const container = draw([4, null, 6, 5])
    // Assert
    expect(container.querySelectorAll('polyline')).toHaveLength(1)
    expect(container.querySelectorAll('[data-dot]')).toHaveLength(1)
  })
})

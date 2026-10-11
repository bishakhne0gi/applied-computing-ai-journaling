import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { RatePointOut } from '@/types/insights'
import { RateChart } from './RateChart'

const points: RatePointOut[] = [
  { entry_id: 'a', created_at: '2026-10-01T09:00:00Z', word_count: 10, error_count: 2, rate: 20 },
  { entry_id: 'b', created_at: '2026-10-02T09:00:00Z', word_count: 8, error_count: 0, rate: 0 },
  { entry_id: 'c', created_at: '2026-10-03T09:00:00Z', word_count: 0, error_count: 0, rate: null },
]

describe('RateChart', () => {
  it('is one image whose name summarises the line and its trend', () => {
    // Arrange + Act
    render(<RateChart points={points} trend="improving" />)
    // Assert
    expect(screen.getByRole('img')).toHaveAccessibleName(
      'Errors per 100 words across 3 entries, oldest to newest: lowest 0.0, highest 20.0, latest 0.0. Overall: improving.',
    )
  })

  it('adds no keyboard stop of its own: the table beside the drawing is the accessible form', () => {
    // Arrange / Act
    const { container } = render(<RateChart points={points} trend="improving" />)
    // Assert
    expect(container.querySelector('[tabindex="0"]')).toBeNull()
  })

  it('draws the rates as one area and keeps every value in the screen-reader table', () => {
    // Arrange / Act
    const { container } = render(<RateChart points={points} trend="improving" />)
    // Assert
    expect(container.querySelectorAll('.recharts-area-curve')).toHaveLength(1)
    const table = screen.getByRole('table', { name: /Errors per 100 words for each entry/ })
    expect(within(table).getAllByRole('row')).toHaveLength(points.length + 1)
  })

  it('reads out the latest entry above the chart', () => {
    // Arrange / Act
    render(<RateChart points={points} trend={null} />)
    // Assert
    expect(screen.getByText('Latest entry')).toBeInTheDocument()
    expect(screen.getByText('0 errors in 0 words')).toBeInTheDocument()
  })

  it('lists every entry’s numbers in a table for screen readers', () => {
    // Arrange + Act
    render(<RateChart points={points} trend={null} />)
    // Assert
    const table = screen.getByRole('table', { name: 'Errors per 100 words for each entry' })
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(4)
    expect(rows[3]).toHaveTextContent('Not measured')
  })
})

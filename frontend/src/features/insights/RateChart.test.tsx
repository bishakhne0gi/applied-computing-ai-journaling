import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RatePointOut } from '@/types/insights'
import { RateChart } from './RateChart'

const rated = (id: string, rate: number | null): RatePointOut => ({
  entry_id: id,
  created_at: '2026-10-01T09:00:00Z',
  word_count: 10,
  error_count: 0,
  rate,
})

const points: RatePointOut[] = [
  { entry_id: 'a', created_at: '2026-10-01T09:00:00Z', word_count: 10, error_count: 2, rate: 20 },
  { entry_id: 'b', created_at: '2026-10-02T09:00:00Z', word_count: 8, error_count: 0, rate: 0 },
  { entry_id: 'c', created_at: '2026-10-03T09:00:00Z', word_count: 0, error_count: 0, rate: null },
]

afterEach(() => vi.restoreAllMocks())

describe('RateChart', () => {
  it('is one image whose name summarises the line and its trend', () => {
    // Arrange + Act
    render(<RateChart points={points} trend="improving" />)
    // Assert
    expect(screen.getByRole('img')).toHaveAccessibleName(
      'Errors per 100 words across 3 entries, oldest to newest: lowest 0.0, highest 20.0, latest 0.0. Overall: improving.',
    )
  })

  it('breaks the line at an unmeasured entry instead of bridging it', () => {
    // Arrange
    const gap = [rated('a', 1), rated('b', 2), rated('gap', null), rated('c', 1), rated('d', 2)]
    // Act
    const { container } = render(<RateChart points={gap} trend={null} />)
    // Assert
    expect(container.querySelectorAll('polyline')).toHaveLength(2)
    expect(container.querySelectorAll('circle')).toHaveLength(4)
  })

  it('draws a lone measured point as a dot without a line', () => {
    // Arrange + Act
    const { container } = render(<RateChart points={[rated('only', 4)]} trend={null} />)
    // Assert
    expect(container.querySelectorAll('polyline')).toHaveLength(0)
    expect(container.querySelectorAll('circle')).toHaveLength(1)
  })

  it('draws equal rates as a flat line and labels a round axis outside the SVG', () => {
    // Arrange
    const flat = [rated('a', 3), rated('b', 3)]
    // Act
    const { container } = render(<RateChart points={flat} trend={null} />)
    // Assert
    const [line] = container.querySelectorAll('polyline')
    expect(line?.getAttribute('points')).toBe('0,80 640,80')
    expect(container.querySelector('svg text')).toBeNull()
    const axis = screen.getByText('2.5').parentElement
    expect([...(axis?.children ?? [])].map((label) => label.textContent)).toEqual(['5', '2.5', '0'])
  })

  it('labels entries under the plot with their date and time', () => {
    // Arrange + Act
    render(<RateChart points={points} trend={null} />)
    // Assert
    expect(screen.getByText('Oct 1')).toBeInTheDocument()
    expect(screen.getByText('Oct 3')).toBeInTheDocument()
    expect(screen.getAllByText(/^\d{1,2}:\d{2}\s?[AP]M$/)).toHaveLength(3)
  })

  it('reads out the latest entry, and the entry under the pointer while hovering', () => {
    // Arrange
    vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 640, 200))
    render(<RateChart points={points} trend={null} />)
    expect(screen.getByText('Latest entry')).toBeInTheDocument()
    expect(screen.getByText('0 errors in 0 words')).toBeInTheDocument()
    // Act
    fireEvent.pointerMove(screen.getByRole('img'), { clientX: 10 })
    // Assert
    const readout = screen.getByText('Entry 1 of 3').parentElement?.parentElement
    expect(readout).toHaveTextContent(/2 errors in 10 words.*20\.0\s*per 100 words/)
    fireEvent.pointerLeave(screen.getByRole('img'))
    expect(screen.getByText('Latest entry')).toBeInTheDocument()
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

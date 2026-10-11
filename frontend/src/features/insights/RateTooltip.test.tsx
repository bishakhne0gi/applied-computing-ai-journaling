import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { RatePointOut } from '@/types/insights'
import { RateTooltip } from './RateTooltip'

const point = (rate: number | null): RatePointOut => ({ entry_id: 'a', created_at: '2026-10-01T09:00:00Z', word_count: 0, error_count: 0, rate })

describe('RateTooltip', () => {
  it('gives a measured rate its unit', () => {
    // Arrange / Act
    render(<RateTooltip points={[point(2)]} active payload={[{ payload: { index: 0 } }]} />)
    // Assert
    expect(screen.getByText('2.0 per 100 words')).toBeInTheDocument()
  })

  it('says "Not measured" alone when the entry had no words, without a dangling unit', () => {
    // Arrange / Act
    render(<RateTooltip points={[point(null)]} active payload={[{ payload: { index: 0 } }]} />)
    // Assert
    expect(screen.getByText('Not measured')).toBeInTheDocument()
    expect(screen.queryByText(/per 100 words/)).not.toBeInTheDocument()
  })
})

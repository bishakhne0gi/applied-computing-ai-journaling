import { describe, expect, it } from 'vitest'
import type { RatePointOut } from '@/types/insights'
import { describeRates, formatRate } from './format'

const point = (rate: number | null): RatePointOut => ({ entry_id: String(rate), created_at: '2026-10-09T18:00:00Z', word_count: 10, error_count: 1, rate })

describe('insights formatting', () => {
  it.each([
    [2, '2.0'],
    [14.3, '14.3'],
    [null, 'Not measured'],
  ])('shows the rate %s as "%s"', (rate, expected) => {
    // Arrange + Act
    const text = formatRate(rate)
    // Assert
    expect(text).toBe(expected)
  })

  it('describes the line in words, with the overall trend when there is one', () => {
    // Arrange
    const points = [point(1.5), point(0), point(3)]
    // Act
    const description = describeRates(points, 'improving')
    // Assert
    expect(description).toBe('Errors per 100 words across 3 entries, oldest to newest: lowest 0.0, highest 3.0, latest 3.0. Overall: improving.')
  })

  it('says when no entry had words to measure', () => {
    // Arrange
    const points = [point(null)]
    // Act
    const description = describeRates(points, null)
    // Assert
    expect(description).toBe('Errors per 100 words across 1 entry, oldest to newest: no words to measure.')
  })
})

import { describe, expect, it } from 'vitest'
import { formatDateTime, pluralize } from './formatter'

describe('pluralize', () => {
  it.each([
    [0, '0 errors'],
    [1, '1 error'],
    [2, '2 errors'],
  ])('says %i as "%s"', (count, expected) => {
    // Arrange
    const noun = 'error'
    // Act
    const phrase = pluralize(count, noun)
    // Assert
    expect(phrase).toBe(expected)
  })

  it('accepts an irregular plural', () => {
    // Arrange
    const count = 3
    // Act
    const phrase = pluralize(count, 'entry', 'entries')
    // Assert
    expect(phrase).toBe('3 entries')
  })
})

describe('formatDateTime', () => {
  it('shows a short, readable date and time', () => {
    // Arrange
    const iso = '2026-10-09T18:00:00Z'
    // Act
    const label = formatDateTime(iso)
    // Assert
    expect(label).toMatch(/^Oct \d{1,2}, 2026, \d{1,2}:\d{2}\s?[AP]M$/)
  })
})

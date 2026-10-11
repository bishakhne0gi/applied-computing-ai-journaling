import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime, formatDay, formatShortDateTime, formatTime, pluralize } from './formatter'

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

describe('formatDate', () => {
  it('shows a short, readable date without the time', () => {
    // Arrange
    const iso = '2026-10-09T12:00:00Z'
    // Act
    const label = formatDate(iso)
    // Assert
    expect(label).toMatch(/^Oct \d{1,2}, 2026$/)
  })
})

describe('formatDay', () => {
  it('names the weekday and date, adding the year only for another year', () => {
    // Arrange
    const iso = '2026-10-08T12:00:00Z'
    // Act + Assert
    expect(formatDay(iso, new Date('2026-12-01T00:00:00Z'))).toBe('Thursday, October 8')
    expect(formatDay(iso, new Date('2027-01-15T00:00:00Z'))).toBe('Thursday, October 8, 2026')
  })
})

describe('formatTime', () => {
  it('shows only the time', () => {
    // Arrange
    const iso = '2026-10-09T18:00:00Z'
    // Act
    const label = formatTime(iso)
    // Assert
    expect(label).toMatch(/^\d{1,2}:\d{2}\s?[AP]M$/)
  })
})

describe('formatShortDateTime', () => {
  it('drops the year this year and keeps it for another year', () => {
    // Arrange
    const iso = '2026-10-08T12:00:00Z'
    // Act + Assert
    expect(formatShortDateTime(iso, new Date('2026-12-01T00:00:00Z'))).toMatch(/^Oct 8, \d{1,2}:\d{2}\s?[AP]M$/)
    expect(formatShortDateTime(iso, new Date('2027-01-15T00:00:00Z'))).toMatch(/^Oct 8, 2026, /)
  })
})

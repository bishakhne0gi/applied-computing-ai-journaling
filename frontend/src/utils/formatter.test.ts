import { describe, expect, it } from 'vitest'
import { pluralize } from './formatter'

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

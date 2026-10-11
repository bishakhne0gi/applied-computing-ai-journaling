import { describe, expect, it } from 'vitest'
import { categoryLabel, failureMessage } from './labels'

describe('labels', () => {
  it('turns a category id into words', () => {
    // Arrange
    const category = 'verb_conjugation'
    // Act
    const label = categoryLabel(category)
    // Assert
    expect(label).toBe('Verb conjugation')
  })

  it.each([
    ['provider_timeout', 'The AI took too long to respond. Your entry is saved. Try again.'],
    ['invalid_output', 'The AI sent back feedback we could not read. Your entry is saved. Try again.'],
    ['provider_error', 'The AI service is unavailable right now. Your entry is saved. Try again.'],
    [null, 'The analysis did not finish. Your entry is saved. Try again.'],
  ] as const)('explains %s and reassures that the entry is saved', (code, expected) => {
    // Arrange
    const failure = code
    // Act
    const message = failureMessage(failure)
    // Assert
    expect(message).toBe(expected)
  })
})

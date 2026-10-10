import { describe, expect, it } from 'vitest'
import { codePointLength, countWords } from './text'

describe('countWords', () => {
  it.each([
    ['', 0],
    ['   ', 0],
    ['Hola mundo', 2],
    ['  uno\n dos\ttres ', 3],
    ['¡Hola! [grocery store]', 3],
  ])('counts %j as %i words, splitting on any whitespace like the backend', (text, expected) => {
    // Arrange
    const input = text
    // Act
    const count = countWords(input)
    // Assert
    expect(count).toBe(expected)
  })
})

describe('codePointLength', () => {
  it('counts an emoji as one character, matching the API offsets', () => {
    // Arrange
    const text = 'Hoy 😀'
    // Act
    const length = codePointLength(text)
    // Assert
    expect(length).toBe(5)
    expect(text.length).toBe(6)
  })
})

import { describe, expect, it } from 'vitest'
import { MAX_ENTRY_CHARS } from './constants'
import { codePointLength, countWords, entryLength, isSubmittableEntry } from './text'

describe('countWords', () => {
  it.each([
    ['', 0],
    ['   ', 0],
    ['Hola mundo', 2],
    ['  uno\n dos\ttres ', 3],
    ['¡Hola! [grocery store]', 3],
    ['a b\uFEFFc\x1Dd\x85e', 4],
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

describe('entry length', () => {
  it('counts code points of the trimmed text', () => {
    // Arrange
    const text = '  😀a \n'
    // Act
    const length = entryLength(text)
    // Assert
    expect(length).toBe(2)
  })

  it.each([
    ['', false],
    ['   ', false],
    ['x', true],
    ['x'.repeat(MAX_ENTRY_CHARS), true],
    ['x'.repeat(MAX_ENTRY_CHARS + 1), false],
    ['😀'.repeat(MAX_ENTRY_CHARS), true],
  ])('decides whether %.12s… can be submitted', (text, expected) => {
    // Arrange
    // Act
    const result = isSubmittableEntry(text)
    // Assert
    expect(result).toBe(expected)
  })
})

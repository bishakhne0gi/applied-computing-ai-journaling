import { describe, expect, it } from 'vitest'
import { MAX_ENTRY_CHARS } from './constants'
import { bracketRanges, codePointLength, countWords, entryLength, isSubmittableEntry } from './text'

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

describe('bracketRanges', () => {
  it.each([
    ['one closed bracket', 'en el [park].', [{ start: 6, end: 12 }]],
    ['two', '[a] y [b c]', [{ start: 0, end: 3 }, { start: 6, end: 11 }]],
    ['an unclosed bracket', 'en el [par', []],
    ['empty brackets', 'x [] y', []],
    ['a bracket across lines', '[par\nk]', []],
    ['nested brackets: only the inner pair', '[a [b] c]', [{ start: 3, end: 6 }]],
  ])('finds %s', (_label, text, expected) => {
    // Arrange + Act
    const ranges = bracketRanges(text)
    // Assert
    expect(ranges).toEqual(expected)
  })
})

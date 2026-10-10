import { describe, expect, it } from 'vitest'
import { buildMistake } from '@/mocks/factories'
import { placeMistakes, segmentText } from './segmentText'

const parts = (text: string, mistakes: ReturnType<typeof buildMistake>[]) =>
  segmentText(text, placeMistakes(text, mistakes).placed).map((s) => [s.text, s.mistake?.id ?? null])

describe('placeMistakes + segmentText', () => {
  it('splits the text around a mistake', () => {
    // Arrange
    const mistake = buildMistake({ id: 'm', start: 5, end: 10 })
    // Act
    const result = parts('Ayer yo es feliz.', [mistake])
    // Assert
    expect(result).toEqual([['Ayer ', null], ['yo es', 'm'], [' feliz.', null]])
  })

  it('counts an emoji as one code point, as the API does', () => {
    // Arrange
    const mistake = buildMistake({ id: 'm', start: 6, end: 11 })
    // Act
    const result = parts('Hoy 😀 yo es feliz.', [mistake])
    // Assert
    expect(result).toEqual([['Hoy 😀 ', null], ['yo es', 'm'], [' feliz.', null]])
  })

  it('keeps accented letters intact', () => {
    // Arrange
    const mistake = buildMistake({ id: 'm', original: 'à le', start: 13, end: 17 })
    // Act
    const result = parts('Je suis allé à le marché.', [mistake])
    // Assert
    expect(result).toEqual([['Je suis allé ', null], ['à le', 'm'], [' marché.', null]])
  })

  it('renders adjacent spans without an empty gap', () => {
    // Arrange
    const mistakes = [buildMistake({ id: 'b', start: 3, end: 6 }), buildMistake({ id: 'a', start: 0, end: 3 })]
    // Act
    const result = parts('abcdef', mistakes)
    // Assert
    expect(result).toEqual([['abc', 'a'], ['def', 'b']])
  })

  it.each([
    ['null offsets', { start: null, end: null }],
    ['an end past the text', { start: 5, end: 99 }],
    ['an empty span', { start: 5, end: 5 }],
    ['a negative start', { start: -1, end: 3 }],
    ['a fractional start', { start: 1.5, end: 4 }],
    ['a fractional end', { start: 1, end: 4.5 }],
  ])('sends a mistake with %s to the unplaced list', (_label, offsets) => {
    // Arrange
    const mistake = buildMistake({ id: 'bad', ...offsets })
    // Act
    const { placed, unplaced } = placeMistakes('Ayer yo es feliz.', [mistake])
    // Assert
    expect(placed).toEqual([])
    expect(unplaced.map((m) => m.id)).toEqual(['bad'])
  })

  it('keeps the first of two overlapping spans and lists the other as unplaced', () => {
    // Arrange
    const mistakes = [buildMistake({ id: 'first', start: 5, end: 10 }), buildMistake({ id: 'overlap', start: 8, end: 12 })]
    // Act
    const { placed, unplaced } = placeMistakes('Ayer yo es feliz.', mistakes)
    // Assert
    expect(placed.map((m) => m.id)).toEqual(['first'])
    expect(unplaced.map((m) => m.id)).toEqual(['overlap'])
  })

  it('returns the whole text as one plain segment when nothing is placed', () => {
    // Arrange
    const text = 'Está bien.'
    // Act
    const result = parts(text, [])
    // Assert
    expect(result).toEqual([['Está bien.', null]])
  })

  it('returns no segments for empty text', () => {
    // Arrange
    const text = ''
    // Act
    const result = parts(text, [])
    // Assert
    expect(result).toEqual([])
  })

  it('places the longer of two spans that start together, whatever order they arrive in', () => {
    // Arrange
    const short = buildMistake({ id: 'short', start: 5, end: 7 })
    const long = buildMistake({ id: 'long', start: 5, end: 10 })
    // Act
    const forward = placeMistakes('Ayer yo es feliz.', [short, long])
    const backward = placeMistakes('Ayer yo es feliz.', [long, short])
    // Assert
    expect(forward.placed.map((m) => m.id)).toEqual(['long'])
    expect(backward.placed.map((m) => m.id)).toEqual(['long'])
    expect(backward.unplaced.map((m) => m.id)).toEqual(['short'])
  })

  it('breaks an exact tie by id so the result never depends on input order', () => {
    // Arrange
    const b = buildMistake({ id: 'b', start: 5, end: 10 })
    const a = buildMistake({ id: 'a', start: 5, end: 10 })
    // Act
    const result = placeMistakes('Ayer yo es feliz.', [b, a])
    // Assert
    expect(result.placed.map((m) => m.id)).toEqual(['a'])
    expect(result.unplaced.map((m) => m.id)).toEqual(['b'])
  })
})

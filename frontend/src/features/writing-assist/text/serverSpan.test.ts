import { describe, expect, it } from 'vitest'
import { fromServerSpan, toServerSpan } from './serverSpan'

describe('server spans', () => {
  it.each([
    ['plain', 'Hoy yo es feliz.', 'Hoy yo es feliz.'],
    ['leading spaces trimmed by the server', '   Ayer fui. Hoy yo es feliz.', 'Hoy yo es feliz.'],
    ['CRLF becomes LF', 'Ayer fui.\r\nHoy yo es feliz.', 'Hoy yo es feliz.'],
    ['emoji before (two UTF-16 units, one code point)', '😊 Ayer. Hoy yo es feliz.', 'Hoy yo es feliz.'],
    ['decomposed accent composed by NFC', 'Café ya. Hoy yo es feliz.', 'Hoy yo es feliz.'],
  ])('%s: the server span is the sentence and maps back to the same value span', (_name, value, sentence) => {
    // Arrange
    const span = { start: value.indexOf(sentence), end: value.indexOf(sentence) + sentence.length }
    // Act
    const server = toServerSpan(value, span)
    // Assert
    if (!server) throw new Error('expected a server span')
    expect(Array.from(server.text).slice(server.start, server.end).join('')).toBe(sentence)
    expect(fromServerSpan(value, server.start, server.end)).toEqual(span)
  })

  it('gives no server span for an empty span', () => {
    expect(toServerSpan('Hoy yo es feliz.', { start: 4, end: 4 })).toBeNull()
  })
})

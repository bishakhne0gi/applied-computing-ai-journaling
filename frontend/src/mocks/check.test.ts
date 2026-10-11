import { describe, expect, it } from 'vitest'
import { check, checkText } from './check'

describe('mock /check', () => {
  it('returns hints whose code-point offsets point at their words', () => {
    // Arrange
    const text = 'Hoy 😀 yo es feliz en el [park].'
    // Act
    const { analyzed_text, hints } = checkText(text)
    // Assert
    const chars = Array.from(analyzed_text)
    expect(hints.map((hint) => chars.slice(hint.start ?? 0, hint.end ?? 0).join(''))).toEqual(hints.map((hint) => hint.original))
    expect(hints.every((hint) => !('id' in hint))).toBe(true)
  })

  it('answers 503 when live hints are switched to unavailable', () => {
    // Arrange + Act
    const response = check({ language: 'es', text: 'Hoy yo es feliz.' }, 'check-unavailable')
    // Assert
    expect(response.status).toBe(503)
  })

  it('rejects an unsupported language or blank text like the backend', () => {
    // Arrange + Act
    const statuses = [check({ language: 'xx', text: 'Hola' }, ''), check({ language: 'es', text: '  ' }, '')].map((r) => r.status)
    // Assert
    expect(statuses).toEqual([422, 422])
  })
})

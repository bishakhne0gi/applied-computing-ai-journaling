import { describe, expect, it } from 'vitest'
import { REPHRASE_TARGET_ID, rephraseDecorations } from './rephraseDecorations'

const underline = { id: 'h1', start: 4, end: 9, className: 'u' }
const elsewhere = { id: 'h2', start: 40, end: 44, className: 'u' }

describe('rephraseDecorations', () => {
  it('returns the base untouched without a span', () => {
    // Arrange + Act
    const result = rephraseDecorations([underline], null)
    // Assert
    expect(result).toEqual([underline])
  })

  it('tints the span and drops hint underlines that overlap it', () => {
    // Arrange + Act
    const result = rephraseDecorations([underline, elsewhere], { start: 0, end: 20 })
    // Assert
    expect(result).toContainEqual({ id: REPHRASE_TARGET_ID, start: 0, end: 20, className: 'rounded-sm bg-primary-soft' })
    expect(result).toContainEqual(elsewhere)
    expect(result).not.toContainEqual(underline)
  })

  it('keeps a decoration that only touches the span', () => {
    // Arrange + Act
    const result = rephraseDecorations([elsewhere], { start: 20, end: 40 })
    // Assert
    expect(result).toContainEqual(elsewhere)
  })
})

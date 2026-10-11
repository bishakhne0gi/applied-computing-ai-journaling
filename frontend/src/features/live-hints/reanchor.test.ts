import { describe, expect, it } from 'vitest'
import type { CheckOut, HintOut } from '@/types/check'
import { codePointToUtf16, hintAtCaret, hintKey, reanchor } from './reanchor'

const hint = (original: string, start: number | null, correction = 'x'): HintOut => ({
  kind: 'error',
  category: 'other',
  original,
  correction,
  explanation: 'why',
  start,
  end: start === null ? null : start + Array.from(original).length,
})
const checked = (analyzed_text: string, ...hints: HintOut[]): CheckOut => ({ analyzed_text, hints })
const spans = (text: string, check: CheckOut, dismissed: Set<string> = new Set()) =>
  reanchor(check, text, dismissed).map((anchored) => [anchored.start, text.slice(anchored.start, anchored.end)])

describe('reanchor', () => {
  it.each([
    ['unchanged text', 'Hoy yo es feliz.', checked('Hoy yo es feliz.', hint('yo es', 4)), [[4, 'yo es']]],
    ['text typed before the hint', 'Ayer y hoy yo es feliz.', checked('Hoy yo es feliz.', hint('yo es', 4)), [[11, 'yo es']]],
    ['the hinted words edited away', 'Hoy yo soy feliz.', checked('Hoy yo es feliz.', hint('yo es', 4)), []],
    ['a repeated phrase: the occurrence nearest the old place', 'yo es, y luego yo es.', checked('yo es, y luego yo es.', hint('yo es', 15)), [[15, 'yo es']]],
    ['an emoji before the hint (code points vs UTF-16)', 'Hoy 😀 yo es.', checked('Hoy 😀 yo es.', hint('yo es', 6)), [[7, 'yo es']]],
    ['a hint that drifted too far', `${'a '.repeat(60)}yo es`, checked('yo es', hint('yo es', 0)), []],
    ['an unplaced hint: first occurrence', 'Hoy yo es feliz.', checked('Hoy yo es feliz.', hint('yo es', null)), [[4, 'yo es']]],
    ['overlapping hints: the later one is dropped', 'la problema es', checked('la problema es', hint('la problema', 0), hint('problema es', 3)), [[0, 'la problema']]],
  ])('handles %s', (_label, text, check, expected) => {
    // Arrange + Act
    const result = spans(text, check)
    // Assert
    expect(result).toEqual(expected)
  })

  it('never brings back a dismissed hint', () => {
    // Arrange
    const yoEs = hint('yo es', 4, 'yo soy')
    // Act
    const result = spans('Hoy yo es feliz.', checked('Hoy yo es feliz.', yoEs), new Set([hintKey(yoEs)]))
    // Assert
    expect(result).toEqual([])
  })

  it('returns nothing before the first check answers', () => {
    // Arrange + Act
    const result = reanchor(undefined, 'Hoy yo es feliz.', new Set())
    // Assert
    expect(result).toEqual([])
  })

  it('gives every placement its own id, even for identical hints', () => {
    // Arrange
    const check = checked('yo es y yo es', hint('yo es', 0), hint('yo es', 8))
    // Act
    const ids = reanchor(check, 'yo es y yo es', new Set()).map((anchored) => anchored.id)
    // Assert
    expect(new Set(ids).size).toBe(2)
  })
})

describe('codePointToUtf16', () => {
  it('counts an emoji as two UTF-16 units', () => {
    // Arrange + Act
    const index = codePointToUtf16('😀 yo', 2)
    // Assert
    expect(index).toBe(3)
  })
})

describe('hintAtCaret', () => {
  it('finds the hint under a collapsed caret and ignores selections', () => {
    // Arrange
    const [anchored] = reanchor(checked('Hoy yo es.', hint('yo es', 4)), 'Hoy yo es.', new Set())
    const textarea = document.createElement('textarea')
    textarea.value = 'Hoy yo es.'
    // Act
    textarea.setSelectionRange(6, 6)
    const atCaret = hintAtCaret(anchored ? [anchored] : [], textarea)
    textarea.setSelectionRange(4, 9)
    const onSelection = hintAtCaret(anchored ? [anchored] : [], textarea)
    // Assert
    expect(atCaret?.original).toBe('yo es')
    expect(onSelection).toBeUndefined()
  })
})

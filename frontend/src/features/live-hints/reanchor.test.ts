import { describe, expect, it } from 'vitest'
import type { CheckOut, HintOut } from '@/types/check'
import { hintAtCaret, hintKey, reanchor } from './reanchor'

// Offsets are code points into the checked text, as the API sends them; `original` is the model's wording, which can
// differ from the text at that span (case, whitespace).
const hint = (original: string, start: number | null, end = start === null ? null : start + Array.from(original).length, correction = 'x'): HintOut => ({
  kind: 'error',
  category: 'other',
  original,
  correction,
  explanation: 'why',
  start,
  end,
})
const checked = (analyzed_text: string, ...hints: HintOut[]): CheckOut => ({ analyzed_text, hints })
const spans = (text: string, check: CheckOut, dismissed: Set<string> = new Set()) =>
  reanchor(check, text, dismissed).map((anchored) => [anchored.start, text.slice(anchored.start, anchored.end)])

const CAFE = 'café es feliz.'

describe('reanchor', () => {
  it.each([
    ['unchanged text', 'Hoy yo es feliz.', checked('Hoy yo es feliz.', hint('yo es', 4)), [[4, 'yo es']]],
    ['text typed before the hint', 'Ayer y hoy yo es feliz.', checked('Hoy yo es feliz.', hint('yo es', 4)), [[11, 'yo es']]],
    ['200 characters typed before the hint', `${'a '.repeat(100)}Hoy yo es feliz.`, checked('Hoy yo es feliz.', hint('yo es', 4)), [[204, 'yo es']]],
    ['text typed after the hint', 'Hoy yo es feliz y tranquilo.', checked('Hoy yo es feliz.', hint('yo es', 4)), [[4, 'yo es']]],
    ['a new word started right after a final hint', 'Hoy yo es feliz', checked('Hoy yo es', hint('yo es', 4)), [[4, 'yo es']]],
    ['the hinted words edited away', 'Hoy yo soy feliz.', checked('Hoy yo es feliz.', hint('yo es', 4)), []],
    ['letters typed onto the end of the hinted word', 'Hoy yo esto', checked('Hoy yo es', hint('yo es', 4)), []],
    ['letters typed onto the start of the hinted word', 'Hoy ayo es.', checked('Hoy yo es.', hint('yo es', 4)), []],
    ['the hinted word fixed by hand into a longer word', 'Hoy está feliz porque estoy.', checked('Hoy es feliz porque estoy.', hint('es', 4, 6, 'está')), []],
    ['the hinted word fixed by hand, with the same word nearby', 'Veo la casa con el papel.', checked('Veo el casa con el papel.', hint('el', 4, 6, 'la')), []],
    ['a sentence-initial capital the model lower-cased', 'Yo es feliz.', checked('Yo es feliz.', hint('yo es', 0, 5)), [[0, 'Yo es']]],
    ['a line break the model wrote as a space', 'yo\nes', checked('yo\nes', hint('yo es', 0, 5)), [[0, 'yo\nes']]],
    ['a repeated phrase: the placed occurrence', 'yo es, y luego yo es.', checked('yo es, y luego yo es.', hint('yo es', 15)), [[15, 'yo es']]],
    ['an emoji before the hint (code points vs UTF-16)', 'Hoy 😀 yo es.', checked('Hoy 😀 yo es.', hint('yo es', 6)), [[7, 'yo es']]],
    ['an emoji inside the hint', 'Mi 😀 perro.', checked('Mi 😀 perro.', hint('😀 perro', 3)), [[3, '😀 perro']]],
    ['leading and trailing whitespace the server trimmed', '\n\n  Ayer yo es feliz.\n', checked('Ayer yo es feliz.', hint('yo es', 5)), [[9, 'yo es']]],
    ['CRLF line breaks the server unified', 'Hoy\r\nyo es.', checked('Hoy\nyo es.', hint('yo es', 4)), [[5, 'yo es']]],
    ['NFD text the server composed', CAFE.normalize('NFD'), checked(CAFE, hint('es', 5)), [[6, 'es']]],
    ['an unplaced hint: first whole-word occurrence', 'Hoy yo esto, yo es.', checked('Hoy yo esto, yo es.', hint('yo es', null)), [[13, 'yo es']]],
    ['an unplaced hint in NFD text', CAFE.normalize('NFD'), checked(CAFE, hint('café', null)), [[0, CAFE.normalize('NFD').slice(0, 5)]]],
    ['an empty span', 'Hoy yo es feliz.', checked('Hoy yo es feliz.', hint('', 4)), []],
    ['overlapping hints: the later one is dropped', 'la problema es', checked('la problema es', hint('la problema', 0), hint('problema es', 3)), [[0, 'la problema']]],
  ])('handles %s', (_label, text, check, expected) => {
    // Arrange + Act
    const result = spans(text, check)
    // Assert
    expect(result).toEqual(expected)
  })

  it('never brings back a dismissed hint', () => {
    // Arrange
    const yoEs = hint('yo es', 4, 9, 'yo soy')
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

  it('keeps a hint id stable while the writer types before it, so an open popover stays open', () => {
    // Arrange
    const check = checked('Hoy yo es feliz.', hint('yo es', 4))
    // Act
    const [before] = reanchor(check, 'Hoy yo es feliz.', new Set())
    const [after] = reanchor(check, 'Ayer y hoy yo es feliz.', new Set())
    // Assert
    expect(after?.id).toBe(before?.id)
  })
})

describe('hintAtCaret', () => {
  const [anchored] = reanchor(checked('Hoy yo es.', hint('yo es', 4)), 'Hoy yo es.', new Set())
  const hints = anchored ? [anchored] : []
  const textarea = document.createElement('textarea')
  textarea.value = 'Hoy yo es.'
  const at = (start: number, end = start) => {
    textarea.setSelectionRange(start, end)
    return hintAtCaret(hints, textarea)?.original
  }

  it('finds the hint under a collapsed caret and ignores selections', () => {
    // Arrange + Act + Assert
    expect(at(6)).toBe('yo es')
    expect(at(4, 9)).toBeUndefined()
  })

  it('opens only for a caret strictly inside the words, so a click on blank space after a final word opens nothing', () => {
    // Arrange + Act + Assert
    expect(at(5)).toBe('yo es')
    expect(at(8)).toBe('yo es')
    expect(at(4)).toBeUndefined()
    expect(at(9)).toBeUndefined()
  })
})

describe('reanchor kinds', () => {
  it('softens a capitalisation-only error to a suggestion: a lower-case start is not a mistake while still writing', () => {
    // Arrange
    const text = 'mi nombre es Bishakh'
    // Act
    const [mi] = reanchor(checked(text, hint('mi', 0, 2, 'Mi')), text, new Set())
    // Assert
    expect(mi?.kind).toBe('suggestion')
  })

  it('keeps a real spelling error an error', () => {
    // Arrange
    const text = 'mi nombre es Bishakh'
    // Act
    const [nombre] = reanchor(checked(text, hint('nombre', 3, 9, 'nómbre')), text, new Set())
    // Assert
    expect(nombre?.kind).toBe('error')
  })
})

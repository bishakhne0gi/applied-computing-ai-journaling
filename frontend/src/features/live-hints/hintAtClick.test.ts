import { describe, expect, it } from 'vitest'
import type { CheckOut } from '@/types/check'
import { reanchor } from './reanchor'
import { hintAtClick } from './hintAtClick'

const TEXT = 'Il va a Paris.'
const check: CheckOut = {
  analyzed_text: TEXT,
  hints: [{ kind: 'error', category: 'other', original: 'a', correction: 'à', explanation: 'why', start: 6, end: 7 }],
}
const hints = reanchor(check, TEXT, new Set())

const box = (left: number, right: number) => ({ left, right, top: 10, bottom: 30 }) as DOMRect

function setup(rects: DOMRect[] | null, caret: number) {
  const frame = document.createElement('div')
  const mark = document.createElement('mark')
  mark.dataset.decorationId = hints[0]?.id
  mark.getClientRects = () => (rects ?? []) as unknown as DOMRectList
  const textarea = document.createElement('textarea')
  textarea.value = TEXT
  frame.append(mark, textarea)
  textarea.setSelectionRange(caret, caret)
  return textarea
}

describe('hintAtClick', () => {
  it('opens a one-character hint when the click lands on its underline, whichever side the caret falls', () => {
    // Arrange
    const textarea = setup([box(100, 110)], 6)
    // Act + Assert
    expect(hintAtClick(hints, textarea, { x: 105, y: 20 })?.original).toBe('a')
  })

  it('ignores a click beside the underline even when the caret sits inside the hint', () => {
    // Arrange
    const textarea = setup([box(100, 110)], 6)
    // Act + Assert
    expect(hintAtClick(hints, textarea, { x: 300, y: 20 })).toBeUndefined()
  })

  it('ignores a click on the underline while text is selected', () => {
    // Arrange
    const textarea = setup([box(100, 110)], 6)
    textarea.setSelectionRange(5, 8)
    // Act + Assert
    expect(hintAtClick(hints, textarea, { x: 105, y: 20 })).toBeUndefined()
  })

  it('falls back to the strict caret rule when nothing can be measured', () => {
    // Arrange + Act + Assert
    expect(hintAtClick(hints, setup(null, 6), { x: 105, y: 20 })).toBeUndefined()
  })
})

import { describe, expect, it } from 'vitest'
import { decorate } from './decorate'

const chip = (start: number, end: number) => ({ start, end, className: 'chip' })

describe('decorate', () => {
  it.each([
    ['plain text', 'Hola', [], [{ text: 'Hola', className: null }]],
    ['one span', 'en el [park].', [chip(6, 12)], [{ text: 'en el ', className: null }, { text: '[park]', className: 'chip' }, { text: '.', className: null }]],
    ['adjacent spans, given out of order', 'abcd', [chip(2, 4), chip(0, 2)], [{ text: 'ab', className: 'chip' }, { text: 'cd', className: 'chip' }]],
    ['an overlap: the later one is skipped', 'abcdef', [chip(0, 4), chip(2, 6)], [{ text: 'abcd', className: 'chip' }, { text: 'ef', className: null }]],
    ['out of range or empty spans', 'abc', [chip(1, 9), chip(2, 2)], [{ text: 'abc', className: null }]],
    ['empty text', '', [chip(0, 1)], []],
  ])('handles %s', (_label, text, decorations, expected) => {
    // Arrange + Act
    const segments = decorate(text, decorations)
    // Assert
    expect(segments).toEqual(expected)
    expect(segments.map((segment) => segment.text).join('')).toBe(text)
  })
})

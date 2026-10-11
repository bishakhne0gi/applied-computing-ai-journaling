import { describe, expect, it } from 'vitest'
import { wordDiff } from './wordDiff'

describe('wordDiff', () => {
  it.each([
    ['identical', 'Hoy estoy feliz.', 'Hoy estoy feliz.', [], []],
    ['one word swapped', 'Hoy yo es feliz.', 'Hoy yo soy feliz.', ['es'], ['soy']],
    ['words added at the start', 'hoy estoy feliz.', 'Sinceramente, hoy estoy feliz.', [], ['Sinceramente,']],
    ['a word dropped', 'Hoy estoy muy feliz.', 'Hoy estoy feliz.', ['muy'], []],
    ['case counts as a change', 'Hoy estoy feliz.', 'hoy estoy feliz.', ['Hoy'], ['hoy']],
    ['accents and emoji', 'Mañana 😊 voy al café.', 'Mañana 😊 iré al café.', ['voy'], ['iré']],
  ])('%s', (_name, before, after, removed, added) => {
    // Arrange / Act
    const diff = wordDiff(before, after)
    // Assert
    expect(diff.before.map((p) => p.text).join('')).toBe(before)
    expect(diff.after.map((p) => p.text).join('')).toBe(after)
    expect(diff.before.filter((p) => p.change === 'removed').map((p) => p.text.trim())).toEqual(removed)
    expect(diff.after.filter((p) => p.change === 'added').map((p) => p.text.trim())).toEqual(added)
  })

  it('joins neighbouring changed words with the space between them into one highlight', () => {
    expect(wordDiff('a b c d', 'a x y d').after).toEqual([
      { text: 'a ', change: 'same' },
      { text: 'x y', change: 'added' },
      { text: ' d', change: 'same' },
    ])
  })
})

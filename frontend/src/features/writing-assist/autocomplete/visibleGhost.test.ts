import { describe, expect, it } from 'vitest'
import { visibleGhost } from './visibleGhost'

const ANSWER = { base: 'Hoy fui al mercado', completion: ' con mi madre.' }

describe('visibleGhost', () => {
  it.each([
    ['no answer', null, 'Hoy fui al mercado', ''],
    ['fresh', ANSWER, 'Hoy fui al mercado', ' con mi madre.'],
    ['typed the next characters', ANSWER, 'Hoy fui al mercado co', 'n mi madre.'],
    ['typed something else', ANSWER, 'Hoy fui al mercado y', ''],
    ['typed all of it', ANSWER, 'Hoy fui al mercado con mi madre.', ''],
    ['deleted before the base', ANSWER, 'Hoy fui al merca', ''],
  ])('%s', (_name, answer, value, expected) => {
    expect(visibleGhost(answer, value)).toBe(expected)
  })
})

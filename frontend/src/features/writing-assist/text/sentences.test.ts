import { describe, expect, it } from 'vitest'
import { isRephrasable, rephraseTarget, sentenceAt, sentenceSpans } from './sentences'

const TEXT = 'Ayer fui al mercado. ¿Y tú?\nHoy yo es muy feliz con mi familia.'
const slice = (span: { start: number; end: number } | null) => span && TEXT.slice(span.start, span.end)

describe('sentences', () => {
  it('splits on sentence ends and line breaks, trimmed', () => {
    expect(sentenceSpans(TEXT, 'es').map(({ start, end }) => TEXT.slice(start, end))).toEqual([
      'Ayer fui al mercado.',
      '¿Y tú?',
      'Hoy yo es muy feliz con mi familia.',
    ])
  })

  it.each([
    ['es', 'El Sr. García vino a casa. Bien.', ['El Sr. García vino a casa.', 'Bien.']],
    ['es', 'Vivo en EE. UU. desde ayer. Bien.', ['Vivo en EE. UU. desde ayer.', 'Bien.']],
    ['de', 'Das ist z. B. gut. Ok.', ['Das ist z. B. gut.', 'Ok.']],
    ['en', 'J. R. R. Tolkien wrote it. Hello.', ['J. R. R. Tolkien wrote it.', 'Hello.']],
    ['fr', 'M. Dupont est là. Oui.', ['M. Dupont est là.', 'Oui.']],
    ['es', 'Vivo en EE. UU. Me gusta.', ['Vivo en EE. UU.', 'Me gusta.']],
  ])('keeps abbreviations inside the sentence: %s', (language, text, expected) => {
    expect(sentenceSpans(text, language).map(({ start, end }) => text.slice(start, end))).toEqual(expected)
  })

  it('leaves a leading emoji after a terminator with the previous sentence, out of the next span', () => {
    const text = 'Hola a todos. 😊 Hoy yo soy feliz.'
    const spans = sentenceSpans(text, 'es').map(({ start, end }) => text.slice(start, end))
    expect(spans).toEqual(['Hola a todos. 😊', 'Hoy yo soy feliz.'])
  })

  it.each([
    [0, 'Ayer fui al mercado.'],
    [20, 'Ayer fui al mercado.'],
    [TEXT.length, 'Hoy yo es muy feliz con mi familia.'],
  ])('caret %i is in %s', (caret, sentence) => {
    expect(slice(sentenceAt(TEXT, caret, 'es'))).toBe(sentence)
  })

  it('has no sentence for a caret in blank text', () => {
    expect(sentenceAt('   ', 1, 'es')).toBeNull()
  })

  it('a selection wins over the caret sentence, trimmed', () => {
    // Arrange
    const start = TEXT.indexOf(' yo es muy')
    const end = TEXT.indexOf(' con')
    // Act
    const span = rephraseTarget(TEXT, start, end, 'es')
    // Assert
    expect(slice(span)).toBe('yo es muy feliz')
  })

  it('without a selection the caret sentence is the target', () => {
    expect(slice(rephraseTarget(TEXT, 5, 5, 'es'))).toBe('Ayer fui al mercado.')
  })

  it.each([
    ['under three words', '¿Y tú?'],
    ['over 500 code points', `${'palabra '.repeat(70)}fin.`],
  ])('%s is not rephrasable', (_name, text) => {
    expect(rephraseTarget(text, 0, 0, 'es')).toBeNull()
  })

  it('counts words and code points', () => {
    expect(isRephrasable('Hoy yo soy')).toBe(true)
    expect(isRephrasable('Hoy yo')).toBe(false)
    expect(isRephrasable(`${'a '.repeat(250)}b`)).toBe(false)
  })
})

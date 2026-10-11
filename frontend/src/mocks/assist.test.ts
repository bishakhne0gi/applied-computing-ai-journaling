import { afterEach, describe, expect, it } from 'vitest'
import { clearMockMode, setMockMode } from '@/test/helpers'
import { complete, completeText, rephrase, rephraseText } from './assist'

const TEXT = 'Ayer fui al mercado. Hoy yo es feliz con mi familia.'
const REQUEST = { language: 'es', text: TEXT, start: 21, end: 52 }

afterEach(clearMockMode)

describe('mock /rephrase', () => {
  it.each([
    ['an unsupported language', { ...REQUEST, language: 'xx' }],
    ['untrimmed text', { ...REQUEST, text: ` ${TEXT}` }],
    ['a span under three words', { ...REQUEST, start: 21, end: 28 }],
    ['a span outside the text', { ...REQUEST, end: 500 }],
    ['an empty span', { ...REQUEST, start: 30, end: 30 }],
    ['a span over 500 code points', { ...REQUEST, text: 'palabra '.repeat(70) + 'fin.', start: 0, end: 501 }],
  ])('rejects %s with 422', (_name, body) => {
    expect(rephrase(body, '').status).toBe(422)
  })

  it('answers 503 when rephrasing is switched to unavailable', async () => {
    // Arrange + Act
    const response = rephrase(REQUEST, 'assist-unavailable')
    // Assert
    expect(response.status).toBe(503)
    expect(response.headers.get('Content-Type')).toContain('problem+json')
    expect(await response.json()).toMatchObject({ detail: expect.stringContaining('unavailable right now') })
  })

  it('answers 200 with the scripted versions', async () => {
    const response = rephrase(REQUEST, '')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(rephraseText(REQUEST))
  })
})

describe('mock /complete', () => {
  it('rejects an unsupported language and blank text', () => {
    expect([complete({ language: 'xx', text: 'Hoy fui al mercado' }, '').status, complete({ language: 'es', text: '   ' }, '').status]).toEqual([422, 422])
  })

  it('answers an empty completion under three words', () => {
    expect(completeText({ language: 'es', text: 'Hoy fui' })).toEqual({ completion: '' })
  })

  it('answers 503 when assist is switched to unavailable', () => {
    setMockMode('assist-unavailable')
    expect(complete({ language: 'es', text: 'Hoy fui al mercado' }, 'assist-unavailable').status).toBe(503)
  })
})

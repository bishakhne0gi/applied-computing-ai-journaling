import { HttpResponse } from 'msw'
import type { CompleteOut, CompleteRequest, RephraseOut, RephraseRequest, VocabularyOut, VersionOut } from '@/types/assist'
import { REPHRASE } from '@/utils/constants'
import { codePointLength, countWords } from '@/utils/text'
import { cleanLanguage, cleanText, invalid, problem } from './responses'

// The Python demo provider's scripted answers (ai/journal_ai/providers/demo_assist.py), pinned together by
// fixtures/assist-demo.json.
const EXPLANATION = 'Demo mode: a scripted rewrite. Set ANTHROPIC_API_KEY for real versions.'

const SPANISH_TONE = { opener: 'Sinceramente, ', tag: ' sin duda' }
const TONES: Record<string, { opener: string; tag: string }> = {
  es: SPANISH_TONE,
  fr: { opener: 'Franchement, ', tag: ' sans doute' },
  de: { opener: 'Ehrlich gesagt ', tag: ' ohne Zweifel' },
  it: { opener: 'Sinceramente, ', tag: ' senza dubbio' },
  pt: { opener: 'Sinceramente, ', tag: ' sem dúvida' },
}

const COMPLETIONS: Record<string, string> = {
  es: ' y fue un buen día.',
  fr: " et c'était une bonne journée.",
  de: ' und es war ein schöner Tag.',
  it: ' ed è stata una bella giornata.',
  pt: ' e foi um bom dia.',
}

const SYNONYMS: Record<string, Record<string, [string, string][]>> = {
  es: {
    feliz: [['contento', 'Demo mode: everyday and a little softer.'], ['alegre', 'Demo mode: cheerful, outgoing.']],
    bonito: [['precioso', 'Demo mode: more striking.'], ['lindo', 'Demo mode: warmer, more casual.']],
  },
  fr: { content: [['heureux', 'Demo mode: a deeper, steadier happiness.'], ['ravi', 'Demo mode: delighted, a little formal.']] },
}

// `\b` is ASCII-only in JS, so word edges are letter lookarounds that also respect «é».
const phrase = (words: string) => new RegExp(`(?<![\\p{L}\\p{N}\\p{M}_])${words}(?![\\p{L}\\p{N}\\p{M}_])`, 'giu')
const CORRECTIONS: [RegExp, string][] = [
  [phrase('la problema'), 'el problema'],
  [phrase('yo es'), 'yo soy'],
  [phrase('a el'), 'al'],
  [phrase('à le'), 'au'],
]

// A capitalised match stays capitalised after correction ("La problema" → "El problema").
const correct = (sentence: string) =>
  CORRECTIONS.reduce(
    (text, [pattern, right]) => text.replace(pattern, (found) => (/^\p{Lu}/u.test(found) ? right.replace(/^./u, (first) => first.toUpperCase()) : right)),
    sentence,
  )

function beforeFinalPunctuation(text: string, tag: string): string {
  const stripped = text.replace(/[.!?…]+$/u, '')
  return stripped + tag + text.slice(stripped.length)
}

function versionsOf(language: string, corrected: string): VersionOut[] {
  const { opener, tag } = TONES[language] ?? SPANISH_TONE
  const first = Array.from(corrected)[0] ?? ''
  const candidates: [VersionOut['tone'], string, string][] = [
    ['natural', 'More natural', corrected],
    ['formal', 'More formal', opener + first.toLowerCase() + corrected.slice(first.length)],
    ['casual', 'More casual', beforeFinalPunctuation(corrected, tag)],
  ]
  return candidates.map(([tone, label, text]) => ({ text, tone, label, explanation: EXPLANATION }))
}

function vocabularyOf(language: string, sentence: string): VocabularyOut[] {
  return Object.entries(SYNONYMS[language] ?? {}).flatMap(([word, alternatives]) => {
    const found = phrase(word).exec(sentence)
    if (!found) return []
    const start = codePointLength(sentence.slice(0, found.index))
    return [{ original: found[0], start, end: start + codePointLength(found[0]), alternatives: alternatives.map(([alt, nuance]) => ({ word: alt, nuance })) }]
  })
}

export function rephraseText({ language, text, start, end }: RephraseRequest): RephraseOut {
  const sentence = Array.from(text).slice(start, end).join('')
  return { sentence, versions: versionsOf(language, correct(sentence)), vocabulary: vocabularyOf(language, sentence) }
}

export function completeText({ language, text }: CompleteRequest): CompleteOut {
  if (countWords(text.replace(/\r\n?/gu, '\n')) < REPHRASE.minWords) return { completion: '' }
  const demo = COMPLETIONS[language] ?? ''
  // A leading space starts a new word; after whitespace there is nothing to start.
  return { completion: /\s$/u.test(text) ? demo.trimStart() : demo }
}

const asRecord = (body: unknown): Record<string, unknown> => (typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {})

const isOffset = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value)

// Mirrors RephraseRequest: normalised text, a span inside it, 3+ words and at most 500 code points.
function parseRephrase(body: unknown): RephraseRequest | null {
  const { text, start, end } = asRecord(body)
  const language = cleanLanguage(body)
  if (!language || typeof text !== 'string' || cleanText(body) !== text) return null
  if (!isOffset(start) || !isOffset(end) || start < 0 || end > codePointLength(text) || start >= end) return null
  return isSentence(Array.from(text).slice(start, end).join('')) ? { language, text, start, end } : null
}

const isSentence = (span: string) => countWords(span) >= REPHRASE.minWords && codePointLength(span) <= REPHRASE.maxChars

const UNAVAILABLE = 'unavailable right now'

export function rephrase(body: unknown, mode: string): Response {
  if (mode === 'assist-unavailable') return problem(503, 'Service Unavailable', `Rephrasing is ${UNAVAILABLE}`)
  const request = parseRephrase(body)
  return request ? HttpResponse.json(rephraseText(request)) : invalid()
}

// The text is not trimmed: the completion depends on a trailing space.
export function complete(body: unknown, mode: string): Response {
  if (mode === 'assist-unavailable') return problem(503, 'Service Unavailable', `Autocomplete is ${UNAVAILABLE}`)
  const { text } = asRecord(body)
  const language = cleanLanguage(body)
  const length = typeof text === 'string' ? codePointLength(text) : 0
  if (!language || typeof text !== 'string' || length < 1 || length > 5000 || text.trim() === '') return invalid()
  return HttpResponse.json(completeText({ language, text }))
}

import { REPHRASE } from '@/utils/constants'
import { codePointLength, countWords } from '@/utils/text'

// UTF-16 offsets into the textarea value.
export interface Span {
  start: number
  end: number
}

function trimSpan(value: string, from: number, to: number): Span | null {
  let start = from
  let end = to
  while (start < end && /\s/u.test(value.charAt(start))) start++
  while (end > start && /\s/u.test(value.charAt(end - 1))) end--
  return end > start ? { start, end } : null
}

// Intl.Segmenter knows «¿…?» and abbreviations better than a regex; a line break always ends a sentence too.
export function sentenceSpans(value: string, language: string): Span[] {
  const segmenter = new Intl.Segmenter(language, { granularity: 'sentence' })
  const spans: Span[] = []
  for (const { segment, index } of segmenter.segment(value)) {
    let offset = index
    for (const line of segment.split('\n')) {
      const trimmed = trimSpan(value, offset, offset + line.length)
      if (trimmed) spans.push(trimmed)
      offset += line.length + 1
    }
  }
  return spans
}

export const isRephrasable = (text: string) => countWords(text) >= REPHRASE.minWords && codePointLength(text) <= REPHRASE.maxChars

export function sentenceAt(value: string, caret: number, language: string): Span | null {
  return sentenceSpans(value, language).find((span) => caret >= span.start && caret <= span.end) ?? null
}

// A selection wins over the caret's sentence; either must be a sentence the backend accepts.
export function rephraseTarget(value: string, selectionStart: number, selectionEnd: number, language: string): Span | null {
  const span = selectionEnd > selectionStart ? trimSpan(value, selectionStart, selectionEnd) : sentenceAt(value, selectionStart, language)
  return span && isRephrasable(value.slice(span.start, span.end)) ? span : null
}

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

// Abbreviations whose period never ends a sentence (Intl.Segmenter has no abbreviation list), per the
// languages the app supports. A single capital letter ("J. R. R.", "M.") counts too.
const ABBREVIATION = /(?:^|[\s¿¡("«])(?:\p{Lu}|sr|sra|srta|dr|dra|ud|uds|vd|vds|sig|sigra|dott|prof|mme|mlle|mr|mrs|ms|st|hr|fr|ee|z|u|d|bzw|ca|usw|vgl|bspw)\.\s*$/iu
// «UU.» / «etc.» can end a sentence, so they only join a following lowercase word.
const SOFT_ABBREVIATION = /(?:^|[\s¿¡("«])(?:uu|etc|a|b|h|s|t|o)\.\s*$/iu
// Emoji after a terminator belong to the sentence they decorate, not the next one.
const LEADING_EMOJI = /^(?:[\p{Extended_Pictographic}\u200d\ufe0f\u{1F3FB}-\u{1F3FF}]+\s*)+/u

interface Piece {
  start: number
  end: number
}

function joinAbbreviations(value: string, pieces: Piece[]): Piece[] {
  const joined: Piece[] = []
  for (const piece of pieces) {
    const previous = joined[joined.length - 1]
    if (previous && continuesAbbreviation(value.slice(previous.start, previous.end), value.slice(piece.start, piece.end))) {
      previous.end = piece.end
    } else {
      joined.push({ ...piece })
    }
  }
  return joined
}

function continuesAbbreviation(before: string, after: string): boolean {
  // The segmenter ends a piece after a line break, which always ends the sentence.
  if (before.includes('\n', before.trimEnd().length)) return false
  return ABBREVIATION.test(before) || (SOFT_ABBREVIATION.test(before) && /^\p{Ll}/u.test(after))
}

function peelEmoji(value: string, pieces: Piece[]): Piece[] {
  const peeled: Piece[] = []
  for (const piece of pieces) {
    const previous = peeled[peeled.length - 1]
    const lead = previous ? LEADING_EMOJI.exec(value.slice(piece.start, piece.end)) : null
    if (previous && lead) {
      previous.end = piece.start + lead[0].length
      if (previous.end < piece.end) peeled.push({ start: previous.end, end: piece.end })
    } else {
      peeled.push({ ...piece })
    }
  }
  return peeled
}

// Intl.Segmenter understands «¿…?» and always breaks after a line break; abbreviations and emoji are fixed up here.
export function sentenceSpans(value: string, language: string): Span[] {
  const segmenter = new Intl.Segmenter(language, { granularity: 'sentence' })
  const pieces = [...segmenter.segment(value)].map(({ segment, index }) => ({ start: index, end: index + segment.length }))
  return joinAbbreviations(value, peelEmoji(value, pieces)).flatMap(({ start, end }) => trimSpan(value, start, end) ?? [])
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

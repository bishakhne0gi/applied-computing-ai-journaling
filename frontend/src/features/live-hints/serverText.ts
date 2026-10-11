// The server checks `normalize_text(text)`: CR/CRLF unified to LF, NFC, trimmed. Hints index that string, so the
// textarea value is rebuilt the same way, remembering where each position of the rebuilt text sits in the value.
export interface ServerView {
  text: string
  toValue: (index: number) => number
}

// NFC is applied per base character with its combining marks: equal to NFC of the whole text for ordinary text, but a
// sequence that composes across chunks (Hangul jamo, say) can differ, and the offsets then drift for that text.
const CHUNK = /\r\n?|\P{M}\p{M}*|\p{M}+/gu
const WORD = /[\p{L}\p{N}\p{M}]/u

export function serverView(value: string): ServerView {
  let text = ''
  const valueAt: number[] = []
  for (const match of value.matchAll(CHUNK)) {
    const piece = match[0].startsWith('\r') ? '\n' : match[0].normalize('NFC')
    for (let i = 0; i < piece.length; i++) valueAt.push(match.index)
    text += piece
  }
  valueAt.push(value.length)
  const lead = text.length - text.trimStart().length
  return { text: text.trim(), toValue: (index) => valueAt[lead + index] ?? value.length }
}

// API offsets count code points; JavaScript strings count UTF-16 units. `offsets[cp]` is the UTF-16 index of code point cp.
export function utf16Offsets(text: string): number[] {
  const offsets = [0]
  let index = 0
  for (const char of text) {
    index += char.length
    offsets.push(index)
  }
  return offsets
}

export function isWordAt(text: string, index: number): boolean {
  const codePoint = text.codePointAt(index)
  return codePoint !== undefined && WORD.test(String.fromCodePoint(codePoint))
}

export function isWordBefore(text: string, index: number): boolean {
  const last = Array.from(text.slice(Math.max(0, index - 2), index)).at(-1)
  return last !== undefined && WORD.test(last)
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// As the backend aligns: a needle that starts or ends with a letter must not start or end inside a word.
export function findWholeWord(text: string, needle: string): [number, number] | null {
  const word = needle.normalize('NFC')
  if (word === '') return null
  const before = isWordAt(word, 0) ? '(?<![\\p{L}\\p{N}\\p{M}])' : ''
  const after = isWordBefore(word, word.length) ? '(?![\\p{L}\\p{N}\\p{M}])' : ''
  const match = new RegExp(`${before}${escapeRegExp(word)}${after}`, 'u').exec(text)
  return match ? [match.index, match.index + word.length] : null
}

import { MAX_ENTRY_CHARS } from './constants'

// Python's str.split() whitespace, which the backend counts with: Unicode White_Space is exactly that set minus
// the four separators U+001C-U+001F, and (unlike JS \s) it excludes U+FEFF. Built from code points because
// no-control-regex rejects control characters written in a regex literal.
const CONTROL_SEPARATORS = `${String.fromCharCode(0x1c)}-${String.fromCharCode(0x1f)}`
const SEPARATORS = new RegExp(`[\\p{White_Space}${CONTROL_SEPARATORS}]+`, 'u')

export function countWords(text: string): number {
  return text.split(SEPARATORS).filter((word) => word !== '').length
}

// API offsets and the backend's length limit count Unicode code points, not UTF-16 units.
export function codePointLength(text: string): number {
  return Array.from(text).length
}

// The backend trims before measuring, so padding never counts against the limit.
export function entryLength(text: string): number {
  return codePointLength(text.trim())
}

export function isSubmittableEntry(text: string): boolean {
  const length = entryLength(text)
  return length > 0 && length <= MAX_ENTRY_CHARS
}

// Closed `[English]` fallbacks only (spec §7.1): the chip appears once the closing bracket is typed. UTF-16 indices,
// because they decorate the textarea value directly.
export function bracketRanges(text: string): { start: number; end: number }[] {
  return Array.from(text.matchAll(/\[[^[\]\n]+\]/gu), (match) => ({ start: match.index, end: match.index + match[0].length }))
}

// Entry ids are UUIDs; anything else in the URL was typed or mangled, and asking the server would only earn a 422.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
  return UUID.test(value)
}

import { MAX_ENTRY_CHARS } from './constants'

export function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed === '' ? 0 : trimmed.split(/\s+/u).length
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

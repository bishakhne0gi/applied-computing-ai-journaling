export function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed === '' ? 0 : trimmed.split(/\s+/u).length
}

// API offsets and the backend's length limit count Unicode code points, not UTF-16 units.
export function codePointLength(text: string): number {
  return Array.from(text).length
}

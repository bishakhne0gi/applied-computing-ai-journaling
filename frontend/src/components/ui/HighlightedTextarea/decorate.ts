export interface Decoration {
  start: number
  end: number
  className: string
}

export interface DecoratedSegment {
  text: string
  className: string | null
}

// UTF-16 indices into the textarea value. Overlapping, empty or out-of-range decorations are skipped: the backdrop
// must render exactly the textarea's text, or the visible text drifts away from the caret.
export function decorate(text: string, decorations: readonly Decoration[]): DecoratedSegment[] {
  const segments: DecoratedSegment[] = []
  let cursor = 0
  for (const { start, end, className } of [...decorations].sort((a, b) => a.start - b.start)) {
    if (start < cursor || end <= start || end > text.length) continue
    if (start > cursor) segments.push({ text: text.slice(cursor, start), className: null })
    segments.push({ text: text.slice(start, end), className })
    cursor = end
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), className: null })
  return segments
}

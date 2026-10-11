import { serverView, utf16Offsets } from '@/features/live-hints/serverText'
import type { Span } from './sentences'

// The server rephrases `serverView(value).text` (normalised, trimmed) and counts code points; the textarea counts
// UTF-16 units of the raw value. `toValue` is monotonic, so the first server index at or past each end is the match.
export function toServerSpan(value: string, span: Span): { text: string; start: number; end: number } | null {
  const view = serverView(value)
  let start = -1
  let end = -1
  for (let i = 0; i <= view.text.length && end < 0; i++) {
    const at = view.toValue(i)
    if (start < 0 && at >= span.start) start = i
    if (at >= span.end) end = i
  }
  if (start < 0 || end <= start) return null
  const units = utf16Offsets(view.text)
  return { text: view.text, start: units.indexOf(start), end: units.indexOf(end) }
}

export function fromServerSpan(value: string, start: number, end: number): Span {
  const view = serverView(value)
  const units = utf16Offsets(view.text)
  return { start: view.toValue(units[start] ?? 0), end: view.toValue(units[end] ?? view.text.length) }
}

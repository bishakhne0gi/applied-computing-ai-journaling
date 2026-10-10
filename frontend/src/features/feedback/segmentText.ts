import type { MistakeOut } from '@/types/analysis'

export type PlacedMistake = MistakeOut & { start: number; end: number }
export interface Segment {
  text: string
  mistake: PlacedMistake | null
}

const LAST = Number.MAX_SAFE_INTEGER
// Start, then the longer span first, then id: the winner of an overlap must not depend on the order the API listed them.
const byPosition = (a: MistakeOut, b: MistakeOut) =>
  (a.start ?? LAST) - (b.start ?? LAST) || (b.end ?? 0) - (a.end ?? 0) || a.id.localeCompare(b.id)

function fits(mistake: MistakeOut, cursor: number, length: number): mistake is PlacedMistake {
  const { start, end } = mistake
  return Number.isInteger(start) && Number.isInteger(end) && start !== null && end !== null && start >= cursor && start < end && end <= length
}

// Offsets are Unicode code points (spec §6). Anything that cannot be drawn safely — null, out of range, empty or
// overlapping — is returned as unplaced so the UI can still show it.
export function placeMistakes(text: string, mistakes: readonly MistakeOut[]) {
  const length = Array.from(text).length
  const placed: PlacedMistake[] = []
  const unplaced: MistakeOut[] = []
  let cursor = 0
  for (const mistake of [...mistakes].sort(byPosition)) {
    if (fits(mistake, cursor, length)) {
      placed.push(mistake)
      cursor = mistake.end
    } else {
      unplaced.push(mistake)
    }
  }
  return { placed, unplaced }
}

// Expects `placed` from placeMistakes: sorted and non-overlapping.
export function segmentText(text: string, placed: readonly PlacedMistake[]): Segment[] {
  const chars = Array.from(text)
  const segments: Segment[] = []
  let cursor = 0
  for (const mistake of placed) {
    if (mistake.start > cursor) segments.push({ text: chars.slice(cursor, mistake.start).join(''), mistake: null })
    segments.push({ text: chars.slice(mistake.start, mistake.end).join(''), mistake })
    cursor = mistake.end
  }
  if (cursor < chars.length) segments.push({ text: chars.slice(cursor).join(''), mistake: null })
  return segments
}

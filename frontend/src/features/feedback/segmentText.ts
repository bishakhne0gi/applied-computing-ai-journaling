import type { MistakeOut } from '@/types/analysis'

export type PlacedMistake = MistakeOut & { start: number; end: number }
export interface Segment {
  text: string
  mistake: PlacedMistake | null
}

const LAST = Number.MAX_SAFE_INTEGER
const byStart = (a: MistakeOut, b: MistakeOut) => (a.start ?? LAST) - (b.start ?? LAST)

function fits(mistake: MistakeOut, cursor: number, length: number): mistake is PlacedMistake {
  const { start, end } = mistake
  return start !== null && end !== null && start >= cursor && start < end && end <= length
}

// Offsets are Unicode code points (spec §6). Anything that cannot be drawn safely — null, out of range, empty or
// overlapping — is returned as unplaced so the UI can still show it.
export function placeMistakes(text: string, mistakes: readonly MistakeOut[]) {
  const length = Array.from(text).length
  const placed: PlacedMistake[] = []
  const unplaced: MistakeOut[] = []
  let cursor = 0
  for (const mistake of [...mistakes].sort(byStart)) {
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

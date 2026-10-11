import type { CheckOut, HintOut } from '@/types/check'

export type LiveHint = Omit<HintOut, 'start' | 'end'> & {
  key: string
  id: string
  start: number
  end: number
}

// How far (UTF-16 units) a hint may travel from where the check saw it before it counts as stale.
const MAX_DRIFT = 80

export function hintKey(hint: Pick<HintOut, 'kind' | 'original' | 'correction'>): string {
  return `${hint.kind}|${hint.original}|${hint.correction}`
}

// API offsets are code points into the checked text; the textarea counts UTF-16 units.
export function codePointToUtf16(text: string, codePoint: number): number {
  return Array.from(text).slice(0, codePoint).join('').length
}

function nearest(text: string, needle: string, around: number): number | null {
  let best: number | null = null
  for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + 1)) {
    if (best === null || Math.abs(at - around) < Math.abs(best - around)) best = at
  }
  return best !== null && Math.abs(best - around) <= MAX_DRIFT ? best : null
}

function locate(hint: HintOut, checked: string, current: string): number | null {
  // An unplaced hint (null offsets) still names its words: anchor it to their first occurrence.
  if (hint.start === null) {
    const at = current.indexOf(hint.original)
    return at === -1 ? null : at
  }
  return nearest(current, hint.original, codePointToUtf16(checked, hint.start))
}

function withoutOverlaps(hints: LiveHint[]): LiveHint[] {
  const kept: LiveHint[] = []
  for (const hint of [...hints].sort((a, b) => a.start - b.start)) {
    if (hint.start >= (kept.at(-1)?.end ?? 0)) kept.push(hint)
  }
  return kept
}

// Hints describe a snapshot while the writer keeps typing: each moves to the occurrence of its words nearest its old
// place, or is dropped. Dismissed hints and overlaps never come back.
export function reanchor(check: CheckOut | undefined, current: string, dismissed: ReadonlySet<string>): LiveHint[] {
  if (!check) return []
  const anchored: LiveHint[] = []
  for (const hint of check.hints) {
    const key = hintKey(hint)
    const at = dismissed.has(key) || hint.original === '' ? null : locate(hint, check.analyzed_text, current)
    if (at !== null) anchored.push({ ...hint, key, id: `${key}@${at}`, start: at, end: at + hint.original.length })
  }
  return withoutOverlaps(anchored)
}

// Only a click that leaves a caret opens a hint: selecting text to edit it must not pop anything up.
export function hintAtCaret(hints: readonly LiveHint[], textarea: HTMLTextAreaElement): LiveHint | undefined {
  const { selectionStart, selectionEnd } = textarea
  if (selectionStart !== selectionEnd) return undefined
  return hints.find((hint) => selectionStart >= hint.start && selectionStart <= hint.end)
}

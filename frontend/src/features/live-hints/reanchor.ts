import type { CheckOut, HintOut } from '@/types/check'
import { findWholeWord, isWordAt, isWordBefore, serverView, utf16Offsets } from './serverText'

export type LiveHint = Omit<HintOut, 'start' | 'end'> & {
  key: string
  id: string
  start: number
  end: number
}

type Placed = Omit<LiveHint, 'id'>
type Span = [number, number]

interface Edit {
  checked: string
  body: string
  prefix: number
  suffix: number
}

export function hintKey(hint: Pick<HintOut, 'kind' | 'original' | 'correction'>): string {
  return `${hint.kind}|${hint.original}|${hint.correction}`
}

// The text between a common prefix and a common suffix is what the writer changed since the check.
function editBetween(checked: string, body: string): Edit {
  const limit = Math.min(checked.length, body.length)
  let prefix = 0
  while (prefix < limit && checked[prefix] === body[prefix]) prefix++
  let suffix = 0
  while (suffix < limit - prefix && checked[checked.length - 1 - suffix] === body[body.length - 1 - suffix]) suffix++
  return { checked, body, prefix, suffix }
}

// A hint the edit touches is dropped, never moved to another occurrence of its words: letters typed straight onto
// either end make it a different word ("es" → "está"), so only a boundary that is not a letter keeps it.
function mapSpan({ checked, body, prefix, suffix }: Edit, [start, end]: Span): Span | null {
  if (end < prefix || (end === prefix && !isWordAt(body, end))) return [start, end]
  const delta = body.length - checked.length
  const tail = checked.length - suffix
  if (start > tail || (start === tail && !isWordBefore(body, start + delta))) return [start + delta, end + delta]
  return null
}

function place(hint: HintOut, offsets: readonly number[], edit: Edit): Span | null {
  // An unplaced hint (null offsets) still names its words: anchor it to their first whole-word occurrence.
  if (hint.start === null || hint.end === null) return findWholeWord(edit.body, hint.original)
  const start = offsets[hint.start]
  const end = offsets[hint.end]
  if (start === undefined || end === undefined || start >= end) return null
  return mapSpan(edit, [start, end])
}

function withoutOverlaps(hints: Placed[]): Placed[] {
  const kept: Placed[] = []
  for (const hint of [...hints].sort((a, b) => a.start - b.start)) {
    if (hint.start >= (kept.at(-1)?.end ?? 0)) kept.push(hint)
  }
  return kept
}

// The nth placement of a hint keeps its id while text moves around it, so an open popover follows it as the writer types.
function withIds(hints: Placed[]): LiveHint[] {
  const seen = new Map<string, number>()
  return hints.map((hint) => {
    const nth = seen.get(hint.key) ?? 0
    seen.set(hint.key, nth + 1)
    return { ...hint, id: `${hint.key}#${nth}` }
  })
}

// Hints describe a snapshot while the writer keeps typing: each span the server placed (not the model's `original`,
// which may differ in case or spacing) is carried across the edit since the check, or dropped if the edit touched it.
// Dismissing a hint hides every occurrence of that exact hint for the session.
export function reanchor(check: CheckOut | undefined, current: string, dismissed: ReadonlySet<string>): LiveHint[] {
  if (!check) return []
  const view = serverView(current)
  const offsets = utf16Offsets(check.analyzed_text)
  const edit = editBetween(check.analyzed_text, view.text)
  const placed: Placed[] = []
  for (const hint of check.hints) {
    const key = hintKey(hint)
    const span = dismissed.has(key) ? null : place(hint, offsets, edit)
    if (span) placed.push({ ...hint, key, start: view.toValue(span[0]), end: view.toValue(span[1]) })
  }
  return withIds(withoutOverlaps(placed))
}

// Only a click that leaves a caret opens a hint: selecting text to edit it must not pop anything up. The caret must be
// strictly inside the words: a click on blank space after a final word puts the caret at its end, and that is no request.
export function hintAtCaret(hints: readonly LiveHint[], textarea: HTMLTextAreaElement): LiveHint | undefined {
  const { selectionStart, selectionEnd } = textarea
  if (selectionStart !== selectionEnd) return undefined
  return hints.find((hint) => selectionStart > hint.start && selectionStart < hint.end)
}

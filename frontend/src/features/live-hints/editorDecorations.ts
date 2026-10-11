import { CHIP_CLASS, type Decoration } from '@/components/ui/HighlightedTextarea'
import { underlineClasses } from '@/features/feedback/markClasses'
import type { LiveHint } from './reanchor'

interface Range {
  start: number
  end: number
}

const overlaps = (a: Range, b: Range) => a.start < b.end && b.start < a.end

// Hints are underlines only, so a hint on a `[word]` chip combines with it (tint + underline) instead of hiding it.
export function editorDecorations(chips: readonly Range[], hints: readonly LiveHint[]): Decoration[] {
  const fromHints = hints.map((hint) => {
    const onChip = chips.some((chip) => chip.start === hint.start && chip.end === hint.end)
    const className = onChip ? `${CHIP_CLASS} ${underlineClasses[hint.kind]}` : underlineClasses[hint.kind]
    return { id: hint.id, start: hint.start, end: hint.end, className }
  })
  const freeChips = chips.filter((chip) => !hints.some((hint) => overlaps(chip, hint))).map((chip) => ({ ...chip, className: CHIP_CLASS }))
  return [...fromHints, ...freeChips]
}

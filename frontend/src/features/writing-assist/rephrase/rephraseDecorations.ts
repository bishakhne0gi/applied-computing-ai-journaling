import { CHIP_CLASS, type Decoration } from '@/components/ui/HighlightedTextarea'
import type { Span } from '../text/sentences'

export const REPHRASE_TARGET_ID = 'rephrase-target'
const TINT = 'rounded-sm bg-primary-soft'

const overlaps = (a: Span, b: Span) => a.start < b.end && b.start < a.end

// The tint minus the chips, so each chip keeps its own outline. The first piece carries the id the popover anchors to.
function tintAround(span: Span, chips: readonly Span[]): Decoration[] {
  const pieces: Span[] = []
  let from = span.start
  for (const chip of [...chips].sort((a, b) => a.start - b.start)) {
    if (chip.start > from) pieces.push({ start: from, end: Math.min(chip.start, span.end) })
    from = Math.max(from, chip.end)
  }
  if (from < span.end) pieces.push({ start: from, end: span.end })
  return pieces.map((piece, index) => ({ ...piece, id: index === 0 ? REPHRASE_TARGET_ID : `${REPHRASE_TARGET_ID}-${index}`, className: TINT }))
}

// Decorations may not overlap. The sentence being rephrased matters more than a hint underline inside it, but a
// [word] chip is the learner's own marker and stays.
export function rephraseDecorations(base: readonly Decoration[], span: Span | null): Decoration[] {
  if (!span) return [...base]
  const inside = base.filter((decoration) => overlaps(decoration, span))
  const chips = inside.filter((decoration) => decoration.className.includes(CHIP_CLASS))
  const tint = tintAround(span, chips)
  if (tint.length === 0) return [...base.filter((decoration) => !inside.includes(decoration)), { ...span, id: REPHRASE_TARGET_ID, className: TINT }]
  return [...base.filter((decoration) => !inside.includes(decoration) || chips.includes(decoration)), ...tint]
}

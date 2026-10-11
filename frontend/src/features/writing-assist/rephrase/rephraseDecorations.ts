import type { Decoration } from '@/components/ui/HighlightedTextarea'
import type { Span } from '../text/sentences'

export const REPHRASE_TARGET_ID = 'rephrase-target'

// Decorations may not overlap, and the sentence being rephrased matters more than a hint underline inside it.
export function rephraseDecorations(base: readonly Decoration[], span: Span | null): Decoration[] {
  if (!span) return [...base]
  const outside = base.filter((decoration) => decoration.end <= span.start || decoration.start >= span.end)
  return [...outside, { id: REPHRASE_TARGET_ID, start: span.start, end: span.end, className: 'rounded-sm bg-primary-soft' }]
}

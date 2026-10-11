import type { MistakeKind } from '@/types/analysis'

// Kind is encoded twice — colour and underline style — so it never relies on colour vision alone.
const underlineClasses: Record<MistakeKind, string> = {
  error: 'underline decoration-mark-error decoration-wavy decoration-2 underline-offset-4',
  suggestion: 'underline decoration-mark-suggestion decoration-dashed decoration-2 underline-offset-4',
  vocab_help: 'underline decoration-mark-vocab decoration-dotted decoration-2 underline-offset-4',
}

// Live hints sit alone on the text, with no tint behind them, and are read on a phone: thicker (so the wave has more
// amplitude) and a little lower than the feedback marks.
export const liveUnderlineClasses: Record<MistakeKind, string> = {
  error: 'underline decoration-mark-error decoration-wavy decoration-3 underline-offset-6',
  suggestion: 'underline decoration-mark-suggestion decoration-dashed decoration-3 underline-offset-6',
  vocab_help: 'underline decoration-mark-vocab decoration-dotted decoration-3 underline-offset-6',
}

export const markClasses: Record<MistakeKind, string> = {
  error: `bg-mark-error-bg ${underlineClasses.error}`,
  suggestion: `bg-mark-suggestion-bg ${underlineClasses.suggestion}`,
  vocab_help: `bg-mark-vocab-bg ${underlineClasses.vocab_help}`,
}

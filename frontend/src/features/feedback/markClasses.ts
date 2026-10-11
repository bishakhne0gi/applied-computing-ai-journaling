import type { MistakeKind } from '@/types/analysis'

// Kind is encoded twice — colour and underline style — so it never relies on colour vision alone. Live hints use the
// underline alone, so it can sit on top of an editor chip.
export const underlineClasses: Record<MistakeKind, string> = {
  error: 'underline decoration-mark-error decoration-wavy decoration-2 underline-offset-4',
  suggestion: 'underline decoration-mark-suggestion decoration-dashed decoration-2 underline-offset-4',
  vocab_help: 'underline decoration-mark-vocab decoration-dotted decoration-2 underline-offset-4',
}

export const markClasses: Record<MistakeKind, string> = {
  error: `bg-mark-error-bg ${underlineClasses.error}`,
  suggestion: `bg-mark-suggestion-bg ${underlineClasses.suggestion}`,
  vocab_help: `bg-mark-vocab-bg ${underlineClasses.vocab_help}`,
}

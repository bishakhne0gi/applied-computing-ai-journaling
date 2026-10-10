import type { MistakeKind } from '@/types/analysis'

// Kind is encoded twice — colour and underline style — so it never relies on colour vision alone.
export const markClasses: Record<MistakeKind, string> = {
  error: 'bg-mark-error-bg underline decoration-mark-error decoration-wavy decoration-2 underline-offset-4',
  suggestion: 'bg-mark-suggestion-bg underline decoration-mark-suggestion decoration-dashed decoration-2 underline-offset-4',
  vocab_help: 'bg-mark-vocab-bg underline decoration-mark-vocab decoration-dotted decoration-2 underline-offset-4',
}

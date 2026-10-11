import type { Category, FailureCode, MistakeKind } from '@/types/analysis'

export const KIND_LABELS: Record<MistakeKind, string> = {
  error: 'Error',
  suggestion: 'Suggestion',
  vocab_help: 'Word help',
}

export function categoryLabel(category: Category): string {
  const words = category.replace(/_/gu, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const FAILURE_MESSAGES: Record<FailureCode, string> = {
  provider_timeout: 'The AI took too long to respond.',
  invalid_output: 'The AI sent back feedback we could not read.',
  provider_error: 'The AI service is unavailable right now.',
}

export function failureMessage(code: FailureCode | null): string {
  const reason = code ? FAILURE_MESSAGES[code] : 'The analysis did not finish.'
  return `${reason} Your entry is saved. Try again.`
}

export const KIND_HINTS: Record<MistakeKind, string> = {
  error: 'A mistake in grammar or spelling.',
  suggestion: 'Correct, but not how a native would say it.',
  vocab_help: 'The word for English you wrote, in [brackets] or not.',
}

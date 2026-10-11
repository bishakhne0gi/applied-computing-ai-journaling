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
  return `${reason} Your entry is saved — try again.`
}

export const KIND_HINTS: Record<MistakeKind, string> = {
  error: 'A grammar or spelling mistake. Errors count towards your errors per 100 words.',
  suggestion: 'Correct, but a native speaker would put it differently. Not counted as an error.',
  vocab_help: 'The word you were looking for, from your [brackets]. Not counted as an error.',
}

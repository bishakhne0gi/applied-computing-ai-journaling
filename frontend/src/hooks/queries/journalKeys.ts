import type { CompleteRequest, RephraseRequest } from '@/types/assist'
import type { CheckRequest } from '@/types/check'

// Query-key factory shared by queries and mutations. `entry(id)` prefixes `analyses(id)`, and `insightsAll` prefixes
// every `insights(language)`, so one invalidation covers each family.
export const journalKeys = {
  languages: ['languages'] as const,
  entryLists: ['entries', 'list'] as const,
  entryList: (language: string | null) => ['entries', 'list', { language }] as const,
  entry: (id: string) => ['entries', 'detail', id] as const,
  analyses: (id: string) => ['entries', 'detail', id, 'analyses'] as const,
  insightsAll: ['insights'] as const,
  insights: (language: string | null) => ['insights', { language }] as const,
  rephrase: (r: RephraseRequest | null) => ['rephrase', r?.language ?? null, r?.text ?? null, r?.start ?? null, r?.end ?? null] as const,
  complete: (r: CompleteRequest | null) => ['complete', r?.language ?? null, r?.text ?? null] as const,
  check: (request: CheckRequest | null) => ['check', request?.language ?? null, request?.text ?? null] as const,
}

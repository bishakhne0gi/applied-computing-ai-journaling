import { skipToken, useQuery } from '@tanstack/react-query'
import type { CompleteOut, CompleteRequest } from '@/types/assist'
import { client } from '@/utils/client'
import { ENDPOINTS } from '@/utils/endpoints'
import { journalKeys } from './journalKeys'

// Keyed by the text before the caret: newer text is a new query and TanStack aborts the superseded request. No
// `placeholderData`: a completion for older text must never be shown after the writer has typed on.
export function useCompletionQuery(request: CompleteRequest | null) {
  return useQuery({
    queryKey: journalKeys.complete(request),
    queryFn: request ? ({ signal }) => client.post(ENDPOINTS.complete, { json: request, signal }).json<CompleteOut>() : skipToken,
    staleTime: Infinity,
    gcTime: 60_000,
    retry: false,
  })
}

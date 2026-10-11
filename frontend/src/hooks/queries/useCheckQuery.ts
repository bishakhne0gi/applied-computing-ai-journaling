import { keepPreviousData, skipToken, useQuery } from '@tanstack/react-query'
import type { CheckOut, CheckRequest } from '@/types/check'
import { client } from '@/utils/client'
import { ENDPOINTS } from '@/utils/endpoints'
import { journalKeys } from './journalKeys'

// Keyed by the text itself: newer text is a new query, and TanStack aborts the superseded request through `signal`
// once nothing observes it, so a late answer never lands on newer text. The previous hints stay (re-anchored by the
// caller) until the new ones arrive. A failure is not retried: hints simply stay hidden.
export function useCheckQuery(request: CheckRequest | null) {
  return useQuery({
    queryKey: journalKeys.check(request),
    queryFn: request ? ({ signal }) => client.post(ENDPOINTS.check, { json: request, signal }).json<CheckOut>() : skipToken,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    gcTime: 60_000,
    retry: false,
  })
}

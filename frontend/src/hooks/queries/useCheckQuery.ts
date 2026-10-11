import { keepPreviousData, skipToken, useQuery } from '@tanstack/react-query'
import type { CheckOut, CheckRequest } from '@/types/check'
import { isHTTPError } from 'ky'
import { client } from '@/utils/client'
import { LIVE_HINTS } from '@/utils/constants'
import { ENDPOINTS } from '@/utils/endpoints'
import { journalKeys } from './journalKeys'

// Keyed by the text itself: newer text is a new query, and TanStack aborts the superseded request through `signal`
// once nothing observes it, so a late answer never lands on newer text. The previous hints stay (re-anchored by the
// caller) until the new ones arrive, but never once there is no request (switch off, too few words). A failure is not
// retried, except an unavailable service (503) once, after the debounce interval; if that fails
// too the caller keeps showing the last good hints.
export function useCheckQuery(request: CheckRequest | null) {
  return useQuery({
    queryKey: journalKeys.check(request),
    queryFn: request ? ({ signal }) => client.post(ENDPOINTS.check, { json: request, signal }).json<CheckOut>() : skipToken,
    placeholderData: request ? keepPreviousData : undefined,
    staleTime: Infinity,
    gcTime: 60_000,
    retry: (failures, error) => failures < 1 && isHTTPError(error) && error.response.status === 503,
    retryDelay: LIVE_HINTS.debounceMs,
  })
}

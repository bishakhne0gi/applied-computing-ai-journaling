import { skipToken, useQuery } from '@tanstack/react-query'
import type { RephraseOut, RephraseRequest } from '@/types/assist'
import { client } from '@/utils/client'
import { ENDPOINTS } from '@/utils/endpoints'
import { journalKeys } from './journalKeys'

// A rephrase is asked for on purpose, so an unavailable service shows its retry button instead of retrying silently.
// The same sentence in the same text answers from the cache for five minutes after the card closes.
export function useRephraseQuery(request: RephraseRequest | null) {
  return useQuery({
    queryKey: journalKeys.rephrase(request),
    queryFn: request ? ({ signal }) => client.post(ENDPOINTS.rephrase, { json: request, signal }).json<RephraseOut>() : skipToken,
    staleTime: Infinity,
    gcTime: 300_000,
    retry: false,
  })
}

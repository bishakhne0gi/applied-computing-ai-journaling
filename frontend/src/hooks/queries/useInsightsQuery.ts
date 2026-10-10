import { useQuery } from '@tanstack/react-query'
import type { InsightsOut } from '@/types/insights'
import { client } from '@/utils/client'
import { ENDPOINTS } from '@/utils/endpoints'
import { journalKeys } from './journalKeys'

export function useInsightsQuery(language: string | null) {
  return useQuery({
    queryKey: journalKeys.insights(language),
    queryFn: () => client.get(ENDPOINTS.insights, { searchParams: language ? { language } : {} }).json<InsightsOut>(),
  })
}

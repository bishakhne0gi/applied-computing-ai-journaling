import { skipToken, useQuery } from '@tanstack/react-query'
import type { AnalysisOut } from '@/types/analysis'
import { client } from '@/utils/client'
import { ENDPOINTS } from '@/utils/endpoints'
import { journalKeys } from './journalKeys'

// Sorted here, not trusted from the API, because the first item is "the latest" everywhere it is shown.
const newestFirst = (analyses: AnalysisOut[]) => [...analyses].sort((a, b) => b.created_at.localeCompare(a.created_at))

export function useAnalysesQuery(entryId: string | null) {
  return useQuery({
    queryKey: journalKeys.analyses(entryId ?? ''),
    queryFn: entryId ? () => client.get(ENDPOINTS.analyses(entryId)).json<AnalysisOut[]>() : skipToken,
    select: newestFirst,
  })
}

import { useQuery } from '@tanstack/react-query'
import type { AnalysisOut } from '@/types/analysis'
import { client } from '@/utils/client'
import { ENDPOINTS } from '@/utils/endpoints'
import { journalKeys } from './journalKeys'

export function useAnalysesQuery(entryId: string) {
  return useQuery({
    queryKey: journalKeys.analyses(entryId),
    queryFn: () => client.get(ENDPOINTS.analyses(entryId)).json<AnalysisOut[]>(),
  })
}

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { journalKeys } from '@/hooks/queries/journalKeys'
import type { AnalysisOut } from '@/types/analysis'
import type { EntryDetailOut } from '@/types/entry'
import { client } from '@/utils/client'
import { ENDPOINTS } from '@/utils/endpoints'

export interface AnalysisCallbacks {
  onAnalysed?: (analysis: AnalysisOut) => void
  onFailed?: (error: Error) => void
}

// A failed model call still resolves (201, status "failed"); only transport errors reject.
// Callbacks are hook-level, not mutate-level: TanStack runs them even after the caller unmounted.
export function useRunAnalysisMutation(callbacks: AnalysisCallbacks = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (entryId: string) => client.post(ENDPOINTS.analyses(entryId)).json<AnalysisOut>(),
    onSuccess: async (analysis) => {
      const id = analysis.entry_id
      // An older refetch still in flight would land after the write below and restore the previous analysis.
      await Promise.all([
        queryClient.cancelQueries({ queryKey: journalKeys.entry(id), exact: true }),
        queryClient.cancelQueries({ queryKey: journalKeys.analyses(id), exact: true }),
      ])
      // Written straight into the cache so the new feedback shows without a flash of the previous analysis.
      queryClient.setQueryData<EntryDetailOut>(journalKeys.entry(id), (old) => old && { ...old, latest_analysis: analysis })
      queryClient.setQueryData<AnalysisOut[]>(journalKeys.analyses(id), (old) => old && [analysis, ...old])
      void queryClient.invalidateQueries({ queryKey: journalKeys.analyses(id) })
      void queryClient.invalidateQueries({ queryKey: journalKeys.entryLists })
      // Any new analysis can move every insights view, filtered or not.
      void queryClient.invalidateQueries({ queryKey: journalKeys.insightsAll })
      callbacks.onAnalysed?.(analysis)
    },
    onError: (error) => callbacks.onFailed?.(error),
  })
}

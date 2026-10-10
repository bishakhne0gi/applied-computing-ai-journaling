import { useMutation, useQueryClient } from '@tanstack/react-query'
import { journalKeys } from '@/hooks/queries/journalKeys'
import type { EntryCreate, EntryDetailOut, EntryOut } from '@/types/entry'
import { client } from '@/utils/client'
import { ENDPOINTS } from '@/utils/endpoints'

// No optimistic insert: the server normalises the text and counts words, and feedback must come from it anyway.
export function useCreateEntryMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: EntryCreate) => client.post(ENDPOINTS.entries, { json: body }).json<EntryOut>(),
    onSuccess: (entry) => {
      queryClient.setQueryData<EntryDetailOut>(journalKeys.entry(entry.id), { ...entry, latest_analysis: null })
      void queryClient.invalidateQueries({ queryKey: journalKeys.entryLists })
    },
  })
}

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { journalKeys } from '@/hooks/queries/journalKeys'
import type { EntryDetailOut, EntryOut, EntryUpdate } from '@/types/entry'
import { client } from '@/utils/client'
import { ENDPOINTS } from '@/utils/endpoints'

interface UpdateEntryVariables {
  id: string
  text: string
}

export function useUpdateEntryMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, text }: UpdateEntryVariables) =>
      client.patch(ENDPOINTS.entry(id), { json: { text } satisfies EntryUpdate }).json<EntryOut>(),
    onSuccess: (entry) => {
      queryClient.setQueryData<EntryDetailOut>(journalKeys.entry(entry.id), (old) => old && { ...old, ...entry })
      void queryClient.invalidateQueries({ queryKey: journalKeys.entryLists })
    },
  })
}

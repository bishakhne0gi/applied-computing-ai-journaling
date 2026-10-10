import { skipToken, useQuery } from '@tanstack/react-query'
import type { EntryDetailOut } from '@/types/entry'
import { client } from '@/utils/client'
import { ENDPOINTS } from '@/utils/endpoints'
import { journalKeys } from './journalKeys'

export function useEntryQuery(id: string | null) {
  return useQuery({
    queryKey: journalKeys.entry(id ?? ''),
    queryFn: id ? () => client.get(ENDPOINTS.entry(id)).json<EntryDetailOut>() : skipToken,
  })
}

import { useInfiniteQuery } from '@tanstack/react-query'
import type { EntryPageOut } from '@/types/entry'
import { client } from '@/utils/client'
import { PAGE_SIZE } from '@/utils/constants'
import { ENDPOINTS } from '@/utils/endpoints'
import { journalKeys } from './journalKeys'

function listParams(language: string | null, cursor: string | undefined): Record<string, string | number> {
  const params: Record<string, string | number> = { limit: PAGE_SIZE }
  if (language) params.language = language
  if (cursor) params.cursor = cursor
  return params
}

export function useEntriesQuery(language: string | null) {
  return useInfiniteQuery({
    queryKey: journalKeys.entryList(language),
    queryFn: ({ pageParam }) =>
      client.get(ENDPOINTS.entries, { searchParams: listParams(language, pageParam) }).json<EntryPageOut>(),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    select: (data) => data.pages.flatMap((page) => page.items),
  })
}

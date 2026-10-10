import { useQuery } from '@tanstack/react-query'
import type { LanguageOut } from '@/types/language'
import { client } from '@/utils/client'
import { ENDPOINTS } from '@/utils/endpoints'
import { journalKeys } from './journalKeys'

export function useLanguagesQuery() {
  return useQuery({
    queryKey: journalKeys.languages,
    queryFn: () => client.get(ENDPOINTS.languages).json<LanguageOut[]>(),
    // The supported list only changes with a deploy.
    staleTime: Infinity,
  })
}

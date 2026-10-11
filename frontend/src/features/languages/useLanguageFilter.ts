import { useEffect } from 'react'
import { useWorkspaceParams } from '@/hooks/misc/useWorkspaceParams'
import { useLanguagesQuery } from '@/hooks/queries/useLanguagesQuery'

type LanguageFilterState = 'pending' | 'failed' | 'ready'

function stateOf(failed: boolean, settled: boolean): LanguageFilterState {
  if (failed) return 'failed'
  return settled ? 'ready' : 'pending'
}

// The filter lives in the URL (one owner: useWorkspaceParams) so Back and shared links keep it; a code the server
// does not offer is not a filter.
export function useLanguageFilter() {
  const { language: requested, setLanguage } = useWorkspaceParams()
  const languages = useLanguagesQuery()
  const known = languages.data?.some((language) => language.code === requested) ?? false
  const staleParam = languages.isSuccess && requested !== null && !known

  useEffect(() => {
    if (staleParam) setLanguage(null, { replace: true })
  }, [staleParam, setLanguage])

  return {
    language: known ? requested : null,
    // "ready" waits for the language list, so an unknown code never reaches the API.
    state: stateOf(languages.isError, languages.isSuccess && !staleParam),
    changeLanguage: (code: string) => setLanguage(code),
  }
}

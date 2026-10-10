import { useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { useLanguagesQuery } from '@/hooks/queries/useLanguagesQuery'

type LanguageFilterState = 'pending' | 'failed' | 'ready'

function stateOf(failed: boolean, settled: boolean): LanguageFilterState {
  if (failed) return 'failed'
  return settled ? 'ready' : 'pending'
}

// The filter lives in the URL so Back and shared links keep it; a code the server does not offer is not a filter.
export function useLanguageFilter() {
  const [searchParams, setSearchParams] = useSearchParams()
  const languages = useLanguagesQuery()
  const requested = searchParams.get('language')
  const known = languages.data?.some((language) => language.code === requested) ?? false
  const staleParam = languages.isSuccess && requested !== null && !known

  useEffect(() => {
    if (staleParam) setSearchParams({}, { replace: true })
  }, [staleParam, setSearchParams])

  return {
    language: known ? requested : null,
    // "ready" waits for the language list, so an unknown code never reaches the API.
    state: stateOf(languages.isError, languages.isSuccess && !staleParam),
    changeLanguage: (code: string) => setSearchParams(code ? { language: code } : {}),
  }
}

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

  // Other params (a future sort, say) belong to the page, so only `language` is ever touched.
  const withLanguage = (code: string) => {
    const next = new URLSearchParams(searchParams)
    if (code) next.set('language', code)
    else next.delete('language')
    return next
  }

  useEffect(() => {
    if (!staleParam) return
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.delete('language')
        return next
      },
      { replace: true },
    )
  }, [staleParam, setSearchParams])

  return {
    language: known ? requested : null,
    // "ready" waits for the language list, so an unknown code never reaches the API.
    state: stateOf(languages.isError, languages.isSuccess && !staleParam),
    changeLanguage: (code: string) => setSearchParams(withLanguage(code)),
  }
}

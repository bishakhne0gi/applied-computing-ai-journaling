import { useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { LoadingState } from '@/components/ui/LoadingState'
import { LanguageSelect } from '@/features/languages/LanguageSelect'
import { useLanguagesQuery } from '@/hooks/queries/useLanguagesQuery'
import { FilteredHistory } from './FilteredHistory'

// The filter lives in the URL so Back and shared links keep it; a code the server does not offer is not a filter.
export function HistoryList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const languages = useLanguagesQuery()
  const requested = searchParams.get('language')
  const known = languages.data?.some((language) => language.code === requested) ?? false
  const language = known ? requested : null
  const staleParam = languages.isSuccess && requested !== null && !known

  useEffect(() => {
    if (staleParam) setSearchParams({}, { replace: true })
  }, [staleParam, setSearchParams])

  const changeLanguage = (code: string) => setSearchParams(code ? { language: code } : {})
  // Wait for the language list before the first fetch, so an unknown code never reaches the API.
  const ready = !languages.isPending && !staleParam

  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-xs">
        <LanguageSelect id="history-language" label="Language" value={language ?? ''} onChange={changeLanguage} allLabel="All languages" />
      </div>
      {ready ? <FilteredHistory language={language} /> : <LoadingState label="Loading entries…" />}
    </div>
  )
}

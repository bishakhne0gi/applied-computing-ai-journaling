import { useSearchParams } from 'react-router'
import { LanguageSelect } from '@/features/languages/LanguageSelect'
import { useEntriesQuery } from '@/hooks/queries/useEntriesQuery'
import { HistoryResults } from './HistoryResults'

// The filter lives in the URL so Back and shared links keep it.
export function HistoryList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const language = searchParams.get('language')
  const entries = useEntriesQuery(language)
  const changeLanguage = (code: string) => setSearchParams(code ? { language: code } : {})

  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-xs">
        <LanguageSelect id="history-language" label="Language" value={language ?? ''} onChange={changeLanguage} allLabel="All languages" />
      </div>
      <HistoryResults entries={entries} filtered={language !== null} />
    </div>
  )
}

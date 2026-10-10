import { LanguageFiltered } from '@/features/languages/LanguageFiltered'
import { FilteredHistory } from './FilteredHistory'

export function HistoryList() {
  return (
    <LanguageFiltered id="history-language" loadingLabel="Loading entries…">
      {(language) => <FilteredHistory language={language} />}
    </LanguageFiltered>
  )
}

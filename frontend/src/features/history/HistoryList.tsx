import { useId } from 'react'
import { LanguageFiltered } from '@/features/languages/LanguageFiltered'
import { FilteredHistory } from './FilteredHistory'

export interface HistoryListProps {
  onStartWriting: () => void
}

export function HistoryList({ onStartWriting }: HistoryListProps) {
  const id = useId()
  return (
    <LanguageFiltered id={id} loadingLabel="Loading entries…">
      {(language) => <FilteredHistory language={language} onStartWriting={onStartWriting} />}
    </LanguageFiltered>
  )
}

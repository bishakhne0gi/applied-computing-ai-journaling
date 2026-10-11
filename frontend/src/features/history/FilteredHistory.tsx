import { useEntriesQuery } from '@/hooks/queries/useEntriesQuery'
import { HistoryResults } from './HistoryResults'

export interface FilteredHistoryProps {
  language: string | null
  onStartWriting: () => void
}

export function FilteredHistory({ language, onStartWriting }: FilteredHistoryProps) {
  const entries = useEntriesQuery(language)
  return <HistoryResults entries={entries} filtered={language !== null} onStartWriting={onStartWriting} />
}

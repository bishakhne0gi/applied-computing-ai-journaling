import { useEntriesQuery } from '@/hooks/queries/useEntriesQuery'
import { HistoryResults } from './HistoryResults'

export function FilteredHistory({ language }: { language: string | null }) {
  const entries = useEntriesQuery(language)
  return <HistoryResults entries={entries} filtered={language !== null} />
}

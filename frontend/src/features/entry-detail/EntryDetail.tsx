import { useState } from 'react'
import { ErrorState } from '@/components/ui/ErrorState'
import { LoadingState } from '@/components/ui/LoadingState'
import { PageHeading } from '@/components/ui/PageHeading'
import { useAnalysesQuery } from '@/hooks/queries/useAnalysesQuery'
import { useEntryQuery } from '@/hooks/queries/useEntryQuery'
import type { AnalysisOut } from '@/types/analysis'
import type { EntryDetailOut } from '@/types/entry'
import { toErrorMessage } from '@/utils/errorMessage'
import { EntryNotFound } from './EntryNotFound'
import { isMissing } from './isMissing'
import { AnalysisSwitcher } from './AnalysisSwitcher'
import { DetailAnalysis } from './DetailAnalysis'
import { EntryHeader } from './EntryHeader'

export interface EntryDetailProps {
  entryId: string
}

function EntryDetailReady({ entry, analyses }: { entry: EntryDetailOut; analyses: AnalysisOut[] }) {
  // null means "the newest", so a new analysis is selected as soon as it lands in the cache.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = analyses.find((analysis) => analysis.id === selectedId) ?? analyses[0] ?? null
  return (
    <div className="flex flex-col gap-6">
      <EntryHeader entry={entry} />
      {analyses.length > 1 && <AnalysisSwitcher analyses={analyses} value={selected?.id ?? ''} onChange={setSelectedId} />}
      <DetailAnalysis key={selected?.id ?? 'none'} entry={entry} analysis={selected} onNewAnalysis={() => setSelectedId(null)} />
    </div>
  )
}

interface EntryDetailBodyProps {
  entry: ReturnType<typeof useEntryQuery>
  analyses: ReturnType<typeof useAnalysesQuery>
}

function EntryDetailBody({ entry, analyses }: EntryDetailBodyProps) {
  // Cached data outranks a failed background refresh: only a first load with nothing to show is an error screen.
  if (entry.isError && !entry.data) {
    return <ErrorState message={toErrorMessage(entry.error)} onRetry={() => void entry.refetch()} />
  }
  if (analyses.isError && !analyses.data) {
    return <ErrorState message={toErrorMessage(analyses.error)} onRetry={() => void analyses.refetch()} />
  }
  if (!entry.data || !analyses.data) return <LoadingState label="Loading entry…" />
  return <EntryDetailReady entry={entry.data} analyses={analyses.data} />
}

export function EntryDetail({ entryId }: EntryDetailProps) {
  const entry = useEntryQuery(entryId)
  const analyses = useAnalysesQuery(entryId)
  const missing = entry.isError && !entry.data && isMissing(entry.error)
  const title = missing ? 'Entry not found' : 'Entry'
  // One heading element in every state: the route change focused it, and swapping it would drop that focus.
  return (
    <div className="flex flex-col gap-6">
      <title>{`${title} · Language Journal`}</title>
      <PageHeading>{title}</PageHeading>
      {missing ? <EntryNotFound /> : <EntryDetailBody entry={entry} analyses={analyses} />}
    </div>
  )
}

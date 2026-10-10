import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/Badge'
import { useRunAnalysisMutation } from '@/hooks/mutations/useRunAnalysisMutation'
import { useLanguageName } from '@/features/languages/useLanguageName'
import type { EntrySummaryOut } from '@/types/entry'
import { formatDateTime, pluralize } from '@/utils/formatter'
import { RetryAnalysisButton } from './RetryAnalysisButton'

export interface EntryRowProps {
  entry: EntrySummaryOut
}

function EntryStatus({ entry }: EntryRowProps) {
  if (entry.latest_status === 'succeeded') {
    return <Badge tone={entry.error_count > 0 ? 'danger' : 'success'}>{pluralize(entry.error_count, 'error')}</Badge>
  }
  if (entry.latest_status === null) return <Badge>Not analyzed</Badge>
  // A pending latest analysis outlived its request (client went away mid-call), so it is as retryable as a failure.
  return <Badge tone="warning">{entry.latest_status === 'pending' ? 'Analysis interrupted' : 'Analysis failed'}</Badge>
}

const OUTCOME_MESSAGE = { succeeded: 'Feedback ready', failed: 'Analysis failed again', pending: '' } as const

export function EntryRow({ entry }: EntryRowProps) {
  const languageName = useLanguageName(entry.language)
  const analyze = useRunAnalysisMutation()
  const linkRef = useRef<HTMLAnchorElement>(null)
  const retried = analyze.data?.status
  // The retry button is gone once the analysis succeeds, so focus would otherwise fall back to the page body.
  useEffect(() => {
    if (retried === 'succeeded') linkRef.current?.focus()
  }, [retried])
  return (
    <li className="flex flex-col gap-3 rounded-md border border-border p-4 md:flex-row md:items-center md:justify-between">
      <Link ref={linkRef} to={`/entries/${entry.id}`} className="flex min-w-0 flex-col gap-1 hover:underline">
        <span className="text-sm text-muted">
          {formatDateTime(entry.created_at)} · {languageName}
        </span>
        <span>{entry.preview}</span>
      </Link>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <EntryStatus entry={entry} />
        {entry.latest_status !== 'succeeded' && (
          <RetryAnalysisButton
            label={entry.latest_status === null ? 'Get feedback' : 'Retry analysis'}
            preview={entry.preview}
            pending={analyze.isPending}
            error={analyze.error}
            onRetry={() => analyze.mutate(entry.id)}
          />
        )}
        <p role="status" className="sr-only">
          {analyze.isPending || !retried ? '' : OUTCOME_MESSAGE[retried]}
        </p>
      </div>
    </li>
  )
}

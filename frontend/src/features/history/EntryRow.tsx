import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/Badge'
import { useWorkspaceParams } from '@/hooks/misc/useWorkspaceParams'
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

const linkClass =
  'flex min-w-0 flex-col gap-1.5 rounded-md px-3 py-2.5 transition-colors hover:bg-surface aria-[current=true]:bg-primary-soft'

export function EntryRow({ entry }: EntryRowProps) {
  const languageName = useLanguageName(entry.language)
  const { entryId, entryHref } = useWorkspaceParams()
  const analyze = useRunAnalysisMutation()
  const linkRef = useRef<HTMLAnchorElement>(null)
  const retried = analyze.data?.status
  // The retry button is gone once the analysis succeeds, so focus would otherwise fall back to the page body.
  useEffect(() => {
    if (retried === 'succeeded') linkRef.current?.focus()
  }, [retried])
  return (
    <li className="flex flex-col gap-1">
      <Link ref={linkRef} to={entryHref(entry.id)} aria-current={entry.id === entryId ? 'true' : undefined} className={linkClass}>
        <span className="line-clamp-2 text-sm text-fg">{entry.preview}</span>
        <span className="flex flex-wrap items-center justify-between gap-2 text-xs text-fg-secondary">
          <span>
            {formatDateTime(entry.created_at)} · {languageName}
          </span>
          <EntryStatus entry={entry} />
        </span>
      </Link>
      {entry.latest_status !== 'succeeded' && (
        <div className="flex flex-col items-start px-3 pb-1">
          <RetryAnalysisButton
            label={entry.latest_status === null ? 'Get feedback' : 'Retry analysis'}
            preview={entry.preview}
            pending={analyze.isPending}
            error={analyze.error}
            onRetry={() => analyze.mutate(entry.id)}
          />
        </div>
      )}
      <p role="status" className="sr-only">
        {analyze.isPending || !retried ? '' : OUTCOME_MESSAGE[retried]}
      </p>
    </li>
  )
}

import { useEffect, useId, useRef } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/Badge'
import { InlineAlert } from '@/components/ui/InlineAlert'
import { useWorkspaceParams } from '@/hooks/misc/useWorkspaceParams'
import { useRunAnalysisMutation } from '@/hooks/mutations/useRunAnalysisMutation'
import { useLanguageName } from '@/features/languages/useLanguageName'
import type { EntrySummaryOut } from '@/types/entry'
import { toErrorMessage } from '@/utils/errorMessage'
import { formatDateTime, pluralize } from '@/utils/formatter'
import { cn } from '@/utils/utils'
import { RetryAnalysisButton } from './RetryAnalysisButton'

export interface EntryRowProps {
  entry: EntrySummaryOut
}

function EntryStatus({ entry, id }: EntryRowProps & { id: string }) {
  if (entry.latest_status === 'succeeded') {
    return <Badge id={id} tone={entry.error_count > 0 ? 'danger' : 'success'}>{pluralize(entry.error_count, 'error')}</Badge>
  }
  if (entry.latest_status === null) return <Badge id={id}>Not analyzed</Badge>
  // A pending latest analysis outlived its request (client went away mid-call), so it is as retryable as a failure.
  return <Badge id={id} tone="warning">{entry.latest_status === 'pending' ? 'Analysis interrupted' : 'Analysis failed'}</Badge>
}

const OUTCOME_MESSAGE = { succeeded: 'Feedback ready', failed: 'Analysis failed again', pending: '' } as const

// The link's ::after stretches over the whole row (one big target, one focus ring), so the retry button can share
// the meta line as a sibling instead of nesting an interactive inside the link.
const linkClass =
  'text-sm text-fg after:absolute after:inset-0 after:rounded-md focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-primary'

export function EntryRow({ entry }: EntryRowProps) {
  const languageName = useLanguageName(entry.language)
  const { entryId, entryHref } = useWorkspaceParams()
  const analyze = useRunAnalysisMutation()
  const linkRef = useRef<HTMLAnchorElement>(null)
  const metaId = useId()
  const statusId = useId()
  const retried = analyze.data?.status
  const current = entry.id === entryId
  // The retry button is gone once the analysis succeeds, so focus would otherwise fall back to the page body.
  useEffect(() => {
    if (retried === 'succeeded') linkRef.current?.focus()
  }, [retried])
  return (
    <li className={cn('relative flex flex-col gap-1.5 rounded-md px-3 py-2.5 transition-colors hover:bg-bg', current && 'bg-primary-soft hover:bg-primary-soft')}>
      <Link ref={linkRef} to={entryHref(entry.id)} aria-current={current ? 'true' : undefined} aria-describedby={`${metaId} ${statusId}`} className={linkClass}>
        <span className="line-clamp-2">{entry.preview}</span>
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs text-fg-secondary">
        <span id={metaId}>
          {formatDateTime(entry.created_at)} · {languageName}
        </span>
        <span className="ml-auto flex items-center gap-2">
          <EntryStatus entry={entry} id={statusId} />
          {entry.latest_status !== 'succeeded' && (
            <RetryAnalysisButton
              label={entry.latest_status === null ? 'Get feedback' : 'Retry analysis'}
              preview={entry.preview}
              pending={analyze.isPending}
              onRetry={() => analyze.mutate(entry.id)}
            />
          )}
        </span>
      </div>
      {analyze.error ? <InlineAlert>{toErrorMessage(analyze.error)}</InlineAlert> : null}
      <p role="status" className="sr-only">
        {analyze.isPending || !retried ? '' : OUTCOME_MESSAGE[retried]}
      </p>
    </li>
  )
}

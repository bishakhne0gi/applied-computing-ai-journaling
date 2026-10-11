import { useEffect, useId, useRef } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/Badge'
import { InlineAlert } from '@/components/ui/InlineAlert'
import { useWorkspaceParams } from '@/hooks/misc/useWorkspaceParams'
import { useRunAnalysisMutation } from '@/hooks/mutations/useRunAnalysisMutation'
import { useLanguageName } from '@/features/languages/useLanguageName'
import type { EntrySummaryOut } from '@/types/entry'
import { toErrorMessage } from '@/utils/errorMessage'
import { formatShortDateTime, pluralize } from '@/utils/formatter'
import { cn } from '@/utils/utils'
import { RetryAnalysisButton } from './RetryAnalysisButton'

export interface EntryRowProps {
  entry: EntrySummaryOut
}

// Short visible words keep every row on one meta line; the hidden "Analysis" keeps the spoken status complete.
function EntryStatus({ entry, id }: EntryRowProps & { id: string }) {
  if (entry.latest_status === 'succeeded') {
    return <Badge id={id} tone={entry.error_count > 0 ? 'danger' : 'success'}>{pluralize(entry.error_count, 'error')}</Badge>
  }
  if (entry.latest_status === null) return <Badge id={id}>Not analyzed</Badge>
  // A pending latest analysis outlived its request (client went away mid-call), so it is as retryable as a failure.
  return (
    <Badge id={id} tone="warning">
      <span className="sr-only">Analysis</span> <span className="capitalize">{entry.latest_status === 'pending' ? 'interrupted' : 'failed'}</span>
    </Badge>
  )
}

const OUTCOME_MESSAGE = { succeeded: 'Feedback ready', failed: 'Analysis failed again', pending: '' } as const

// The link's ::after stretches over the whole row (one big target, one focus ring), so the retry button can share
// the meta line as a sibling instead of nesting an interactive inside the link.
const linkClass =
  'text-sm text-fg after:absolute after:inset-0 after:rounded-md focus-visible:after:shadow-focus'

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
      <Link ref={linkRef} to={entryHref(entry.id)} aria-current={current ? 'true' : undefined} aria-describedby={`${metaId} ${statusId}`} data-ring="custom" className={linkClass}>
        <span className="line-clamp-2">{entry.preview}</span>
      </Link>
      <div className="flex min-h-5 items-center justify-between gap-2 text-xs text-fg-secondary">
        <span id={metaId} className="min-w-0 truncate">
          {formatShortDateTime(entry.created_at)} · {languageName}
        </span>
        {/* The action sits before the pill so every pill ends on the same right edge. */}
        <span className="flex shrink-0 items-center gap-2">
          {entry.latest_status !== 'succeeded' && (
            <RetryAnalysisButton
              label={entry.latest_status === null ? 'Get feedback' : 'Retry analysis'}
              preview={entry.preview}
              pending={analyze.isPending}
              onRetry={() => analyze.mutate(entry.id)}
            />
          )}
          <EntryStatus entry={entry} id={statusId} />
        </span>
      </div>
      {analyze.error ? <InlineAlert>{toErrorMessage(analyze.error)}</InlineAlert> : null}
      <p role="status" className="sr-only">
        {analyze.isPending || !retried ? '' : OUTCOME_MESSAGE[retried]}
      </p>
    </li>
  )
}

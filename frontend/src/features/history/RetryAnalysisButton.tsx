import { Button } from '@/components/ui/Button'
import { InlineAlert } from '@/components/ui/InlineAlert'
import { toErrorMessage } from '@/utils/errorMessage'

export interface RetryAnalysisButtonProps {
  label: string
  // Part of the accessible name so a list of identical "Retry analysis" buttons stays distinguishable.
  preview: string
  pending: boolean
  error: unknown
  onRetry: () => void
}

export function RetryAnalysisButton({ label, preview, pending, error, onRetry }: RetryAnalysisButtonProps) {
  const text = pending ? 'Analyzing…' : label
  return (
    <>
      <Button variant="ghost" onClick={onRetry} disabled={pending} aria-label={`${text}: ${preview}`} className="-ml-3 px-3 text-primary hover:text-primary-pressed">
        {text}
      </Button>
      {error ? <InlineAlert>{toErrorMessage(error)}</InlineAlert> : null}
    </>
  )
}

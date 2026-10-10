import { ErrorState } from '@/components/ui/ErrorState'
import type { AnalysisOut } from '@/types/analysis'
import { toErrorMessage } from '@/utils/errorMessage'
import { failureMessage } from './labels'

export interface AnalysisFailureProps {
  analysis: AnalysisOut | null
  requestError: unknown
  isRetrying: boolean
  onRetry: () => void
}

export function AnalysisFailure({ analysis, requestError, isRetrying, onRetry }: AnalysisFailureProps) {
  const message = requestError
    ? `${toErrorMessage(requestError)} Your entry is saved.`
    : failureMessage(analysis?.error_code ?? null)
  return (
    <ErrorState message={message} onRetry={onRetry} retryLabel={isRetrying ? 'Retrying…' : 'Retry analysis'} retrying={isRetrying} />
  )
}

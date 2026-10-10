import { Button } from '@/components/ui/Button'
import { InlineAlert } from '@/components/ui/InlineAlert'
import { useRunAnalysisMutation } from '@/hooks/mutations/useRunAnalysisMutation'
import { toErrorMessage } from '@/utils/errorMessage'

export interface RetryAnalysisButtonProps {
  entryId: string
  label: string
  // Part of the accessible name so a list of identical "Retry analysis" buttons stays distinguishable.
  preview: string
}

export function RetryAnalysisButton({ entryId, label, preview }: RetryAnalysisButtonProps) {
  const analyze = useRunAnalysisMutation()
  const text = analyze.isPending ? 'Analyzing…' : label
  return (
    <>
      <Button onClick={() => analyze.mutate(entryId)} disabled={analyze.isPending} aria-label={`${text}: ${preview}`}>
        {text}
      </Button>
      {analyze.isError && (
        <InlineAlert>{toErrorMessage(analyze.error)}</InlineAlert>
      )}
    </>
  )
}

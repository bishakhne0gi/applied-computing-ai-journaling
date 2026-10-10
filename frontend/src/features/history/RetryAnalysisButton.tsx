import { Button } from '@/components/ui/Button'
import { useRunAnalysisMutation } from '@/hooks/mutations/useRunAnalysisMutation'
import { toErrorMessage } from '@/utils/errorMessage'

export interface RetryAnalysisButtonProps {
  entryId: string
  label: string
  describedBy: string
}

export function RetryAnalysisButton({ entryId, label, describedBy }: RetryAnalysisButtonProps) {
  const analyze = useRunAnalysisMutation()
  return (
    <>
      <Button onClick={() => analyze.mutate(entryId)} disabled={analyze.isPending} aria-describedby={describedBy}>
        {analyze.isPending ? 'Analyzing…' : label}
      </Button>
      {analyze.isError && (
        <span role="alert" className="text-sm text-danger">
          {toErrorMessage(analyze.error)}
        </span>
      )}
    </>
  )
}

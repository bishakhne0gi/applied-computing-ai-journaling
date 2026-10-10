import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { RevisableFeedback } from '@/features/editor/RevisableFeedback'
import { AnalysisFailure } from '@/features/feedback/AnalysisFailure'
import { useRunAnalysisMutation } from '@/hooks/mutations/useRunAnalysisMutation'
import type { AnalysisOut } from '@/types/analysis'
import type { EntryOut } from '@/types/entry'

export interface DetailAnalysisProps {
  entry: EntryOut
  analysis: AnalysisOut | null
  onNewAnalysis: () => void
}

export function DetailAnalysis({ entry, analysis, onNewAnalysis }: DetailAnalysisProps) {
  const analyze = useRunAnalysisMutation()
  const run = () => analyze.mutate(entry.id, { onSuccess: onNewAnalysis })
  if (analysis?.status === 'succeeded') {
    return <RevisableFeedback entry={entry} analysis={analysis} onRevised={onNewAnalysis} />
  }
  if (analysis || analyze.isError) {
    return <AnalysisFailure analysis={analysis} requestError={analyze.error} isRetrying={analyze.isPending} onRetry={run} />
  }
  return (
    <EmptyState title="No feedback yet">
      <p className="whitespace-pre-wrap">{entry.text}</p>
      <Button variant="primary" onClick={run} disabled={analyze.isPending}>
        {analyze.isPending ? 'Analyzing…' : 'Get feedback'}
      </Button>
    </EmptyState>
  )
}

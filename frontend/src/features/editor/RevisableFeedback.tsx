import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { FeedbackView } from '@/features/feedback/FeedbackView'
import type { AnalysisOut } from '@/types/analysis'
import type { EntryOut } from '@/types/entry'
import { ReviseEditor } from './ReviseEditor'

export interface RevisableFeedbackProps {
  entry: EntryOut
  analysis: AnalysisOut
  extraActions?: ReactNode
  onRevised?: () => void
}

export function RevisableFeedback({ entry, analysis, extraActions, onRevised }: RevisableFeedbackProps) {
  const [revising, setRevising] = useState(false)
  if (revising) {
    const finish = () => {
      setRevising(false)
      onRevised?.()
    }
    return <ReviseEditor entryId={entry.id} initialText={entry.text} onDone={finish} onCancel={() => setRevising(false)} />
  }
  const actions = (
    <>
      <Button variant="primary" onClick={() => setRevising(true)}>
        Revise &amp; re-check
      </Button>
      {extraActions}
    </>
  )
  return <FeedbackView key={analysis.id} analysis={analysis} actions={actions} />
}

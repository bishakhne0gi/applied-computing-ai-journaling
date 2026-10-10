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
  // True when the feedback is the direct result of the user's action (e.g. just analysed), not a page being opened.
  focusFeedback?: boolean
}

export function RevisableFeedback({ entry, analysis, extraActions, onRevised, focusFeedback = false }: RevisableFeedbackProps) {
  const [revising, setRevising] = useState(false)
  // The new analysis the editor is waiting to see arrive as the `analysis` prop; the editor stays up until it does.
  const [awaitedId, setAwaitedId] = useState<string | null>(null)
  // After leaving the editor its fields are gone, so focus must land on the feedback instead of the page body.
  const [leftEditor, setLeftEditor] = useState(false)
  if (revising && analysis.id !== awaitedId) {
    const cancel = () => {
      setRevising(false)
      setLeftEditor(true)
    }
    const finish = (revised: AnalysisOut) => {
      setAwaitedId(revised.id)
      setLeftEditor(true)
      onRevised?.()
    }
    return <ReviseEditor entryId={entry.id} initialText={entry.text} onDone={finish} onCancel={cancel} />
  }
  const actions = (
    <>
      <Button
        variant="primary"
        onClick={() => {
          setAwaitedId(null)
          setRevising(true)
        }}
      >
        Revise &amp; re-check
      </Button>
      {extraActions}
    </>
  )
  return <FeedbackView key={analysis.id} analysis={analysis} actions={actions} focusHeading={focusFeedback || leftEditor} />
}

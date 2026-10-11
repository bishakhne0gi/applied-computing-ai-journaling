import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { RevisableFeedback } from '@/features/editor/RevisableFeedback'
import { useBackgroundToasts } from './useBackgroundToasts'
import { useDraft } from './useDraft'
import { useWriteSession } from './useWriteSession'
import { WriteEditor } from './WriteEditor'

export interface WriteScreenProps {
  heading?: ReactNode
  // True when the learner navigated here (New entry, Back): the editor takes focus. Never on first load.
  focusEditor?: boolean
}

export function WriteScreen({ heading, focusEditor = false }: WriteScreenProps) {
  const draft = useDraft()
  const session = useWriteSession(draft.clearText, useBackgroundToasts())
  // Seeded from the prop; "New entry" inside a finished session focuses the fresh editor too.
  const [editorFocused, setEditorFocused] = useState(focusEditor)
  const { entry, analysis, phase } = session
  const startOver = () => {
    session.reset()
    setEditorFocused(true)
  }
  const newEntryButton = <Button onClick={startOver}>New entry</Button>
  const succeeded = phase === 'done' && entry !== null && analysis?.status === 'succeeded'

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        {heading}
        {/* A prompt for the blank page; once the outcome shows, the feedback is the page. */}
        {phase !== 'done' && <p className="text-muted">Write freely in the language you are learning, then get feedback.</p>}
      </div>
      {succeeded && entry && analysis ? (
        <RevisableFeedback entry={entry} analysis={analysis} extraActions={newEntryButton} focusFeedback />
      ) : (
        <WriteEditor draft={draft} session={session} focusOnMount={editorFocused} newEntryButton={newEntryButton} />
      )}
    </div>
  )
}

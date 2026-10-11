import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { RevisableFeedback } from '@/features/editor/RevisableFeedback'
import { useDraft } from './useDraft'
import { useWriteSession } from './useWriteSession'
import { WriteEditor } from './WriteEditor'
import { WriteStatus } from './WriteStatus'

export interface WriteScreenProps {
  // True when the learner navigated here (New entry, Back): the editor takes focus. Never on first load.
  focusEditor?: boolean
}

export function WriteScreen({ focusEditor = false }: WriteScreenProps) {
  const draft = useDraft()
  const session = useWriteSession(draft.clearText)
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
    <div className="flex flex-col gap-4">
      <WriteStatus phase={phase} hasDraft={draft.text.trim() !== ''} draftPersisted={draft.persisted} />
      {succeeded && entry && analysis ? (
        <RevisableFeedback entry={entry} analysis={analysis} extraActions={newEntryButton} focusFeedback />
      ) : (
        <WriteEditor draft={draft} session={session} focusOnMount={editorFocused} newEntryButton={newEntryButton} />
      )}
    </div>
  )
}

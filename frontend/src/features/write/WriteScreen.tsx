import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { RevisableFeedback } from '@/features/editor/RevisableFeedback'
import { useDraft } from './useDraft'
import { useWriteSession } from './useWriteSession'
import { WriteEditor } from './WriteEditor'
import { WriteStatus } from './WriteStatus'

export function WriteScreen() {
  const draft = useDraft()
  const session = useWriteSession(draft.clearText)
  // False on first load so the page never steals focus; true after "New entry".
  const [focusEditor, setFocusEditor] = useState(false)
  const { entry, analysis, phase } = session
  const startOver = () => {
    session.reset()
    setFocusEditor(true)
  }
  const newEntryButton = <Button onClick={startOver}>New entry</Button>
  const succeeded = phase === 'done' && entry !== null && analysis?.status === 'succeeded'

  return (
    <div className="flex flex-col gap-4">
      <WriteStatus phase={phase} hasDraft={draft.text.trim() !== ''} />
      {succeeded && entry && analysis ? (
        <RevisableFeedback entry={entry} analysis={analysis} extraActions={newEntryButton} />
      ) : (
        <WriteEditor draft={draft} session={session} focusOnMount={focusEditor} newEntryButton={newEntryButton} />
      )}
    </div>
  )
}

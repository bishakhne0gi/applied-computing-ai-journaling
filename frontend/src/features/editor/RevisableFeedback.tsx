import { useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { FeedbackView } from '@/features/feedback/FeedbackView'
import type { AnalysisOut } from '@/types/analysis'
import type { EntryOut } from '@/types/entry'
import { SavedRephrase } from '@/features/writing-assist/rephrase/SavedRephrase'
import { textOffsetOf } from '@/features/writing-assist/rephrase/textNodes'
import { ReviseEditor } from './ReviseEditor'

export interface RevisableFeedbackProps {
  entry: EntryOut
  analysis: AnalysisOut
  extraActions?: ReactNode
  onRevised?: () => void
  // True when the feedback is the direct result of the user's action (e.g. just analysed), not a page being opened.
  focusFeedback?: boolean
}

// Where the learner had selected in the entry text, as an index into it; null when the selection is elsewhere.
function selectedOffset(): number | null {
  const selection = window.getSelection()
  const root = document.querySelector('[data-entry-text]')
  if (!selection?.anchorNode || !root) return null
  return textOffsetOf(root, selection.anchorNode, selection.anchorOffset)
}

export function RevisableFeedback({ entry, analysis, extraActions, onRevised, focusFeedback = false }: RevisableFeedbackProps) {
  const [revising, setRevising] = useState(false)
  // The new analysis the editor is waiting to see arrive as the `analysis` prop; the editor stays up until it does.
  const [awaitedId, setAwaitedId] = useState<string | null>(null)
  // After leaving the editor its fields are gone, so focus must land on the feedback instead of the page body.
  const [leftEditor, setLeftEditor] = useState(false)
  // undefined = closed. Read on pointer-down because some browsers collapse the selection when a button is pressed.
  const [rephraseAt, setRephraseAt] = useState<number | null | undefined>(undefined)
  const opener = useRef<HTMLButtonElement>(null)
  const pressed = useRef<number | null | undefined>(undefined)
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
      <Button
        ref={opener}
        onPointerDown={() => {
          pressed.current = selectedOffset()
        }}
        onClick={() => {
          setRephraseAt(pressed.current === undefined ? selectedOffset() : pressed.current)
          pressed.current = undefined
        }}
      >
        <Icon name="sparkle" className="size-4 text-primary" />
        Rephrase a sentence
      </Button>
      {extraActions}
    </>
  )
  const closeRephrase = () => {
    setRephraseAt(undefined)
    opener.current?.focus()
  }
  return (
    <FeedbackView key={analysis.id} analysis={analysis} actions={actions} focusHeading={focusFeedback || leftEditor}>
      {rephraseAt !== undefined && <SavedRephrase key={analysis.id} language={entry.language} text={analysis.input_text} initialOffset={rephraseAt} onClose={closeRephrase} />}
    </FeedbackView>
  )
}

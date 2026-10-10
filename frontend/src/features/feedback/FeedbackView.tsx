import { useCallback, useId, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import type { AnalysisOut, MistakeOut } from '@/types/analysis'
import { AnnotatedText } from './AnnotatedText'
import { Legend } from './Legend'
import { MistakePanel } from './MistakePanel'
import { OtherNotes } from './OtherNotes'
import { placeMistakes } from './segmentText'

export interface FeedbackViewProps {
  analysis: AnalysisOut
  actions?: ReactNode
}

// Callers key this by analysis id, so switching analyses resets the open panel and the toggle.
export function FeedbackView({ analysis, actions }: FeedbackViewProps) {
  const [selected, setSelected] = useState<MistakeOut | null>(null)
  const [showCorrected, setShowCorrected] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const headingId = useId()
  const panelId = useId()
  const { placed, unplaced } = placeMistakes(analysis.input_text, analysis.mistakes)

  const open = (mistake: MistakeOut, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger
    setSelected(mistake)
  }
  const close = useCallback(() => {
    setSelected(null)
    triggerRef.current?.focus()
  }, [])
  const toggleCorrected = () => {
    setSelected(null)
    setShowCorrected((shown) => !shown)
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h2 id={headingId} className="text-xl font-semibold">
        Feedback
      </h2>
      <p>{analysis.feedback_summary}</p>
      {analysis.mistakes.length === 0 && <p className="text-muted">Nothing to correct in this entry.</p>}
      <Legend mistakes={analysis.mistakes} />
      <div>
        <Button aria-pressed={showCorrected} onClick={toggleCorrected}>
          Show corrected version
        </Button>
      </div>
      {showCorrected ? (
        <p className="text-lg leading-loose whitespace-pre-wrap">{analysis.corrected_text ?? analysis.input_text}</p>
      ) : (
        <AnnotatedText text={analysis.input_text} placed={placed} selectedId={selected?.id ?? null} panelId={panelId} onSelect={open} />
      )}
      {selected && <MistakePanel id={panelId} mistake={selected} onClose={close} />}
      <OtherNotes mistakes={unplaced} />
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </section>
  )
}

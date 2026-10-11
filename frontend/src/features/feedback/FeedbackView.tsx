import { SectionHeading } from '@/components/ui/SectionHeading'
import { useCallback, useId, useRef, useState, type ReactNode } from 'react'
import { useFocusOnMount } from '@/hooks/misc/useFocusOnMount'
import type { AnalysisOut, MistakeOut } from '@/types/analysis'
import { AnnotatedText } from './AnnotatedText'
import { Legend } from './Legend'
import { MistakePanel } from './MistakePanel'
import { OtherNotes } from './OtherNotes'
import { placeMistakes } from './segmentText'
import { TextVersions } from './TextVersions'

export interface FeedbackViewProps {
  analysis: AnalysisOut
  actions?: ReactNode
  focusHeading?: boolean
}

// Callers key this by analysis id, so switching analyses resets the open panel and the text version.
export function FeedbackView({ analysis, actions, focusHeading = false }: FeedbackViewProps) {
  const [selected, setSelected] = useState<MistakeOut | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const headingId = useId()
  const headingRef = useFocusOnMount<HTMLHeadingElement>()
  const panelId = useId()
  const { placed, unplaced } = placeMistakes(analysis.input_text, analysis.mistakes)

  const close = useCallback(() => {
    setSelected(null)
    triggerRef.current?.focus()
  }, [])
  const open = (mistake: MistakeOut, trigger: HTMLButtonElement) => {
    if (selected?.id === mistake.id) return close()
    triggerRef.current = trigger
    setSelected(mistake)
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <SectionHeading id={headingId} ref={focusHeading ? headingRef : undefined} tabIndex={-1}>
        Feedback
      </SectionHeading>
      <p className="max-w-prose">{analysis.feedback_summary}</p>
      {analysis.mistakes.length === 0 && <p className="text-muted">Nothing to correct in this entry.</p>}
      <Legend mistakes={analysis.mistakes} />
      <TextVersions analysis={analysis} onSwitch={() => setSelected(null)} hasHighlights={placed.length > 0}>
        <AnnotatedText text={analysis.input_text} placed={placed} selectedId={selected?.id ?? null} panelId={panelId} onSelect={open} />
      </TextVersions>
      {selected && <MistakePanel id={panelId} mistake={selected} onClose={close} />}
      <OtherNotes mistakes={unplaced} />
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </section>
  )
}

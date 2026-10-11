import { useId, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toast'
import { useFocusOnMount } from '@/hooks/misc/useFocusOnMount'
import { isRephrasable, sentenceSpans, type Span } from '../text/sentences'
import { toServerSpan } from '../text/serverSpan'
import { RephraseCard } from './RephraseCard'

export interface SavedRephraseProps {
  language: string
  text: string // an analysis' input_text: already the server's text, so offsets need no mapping
  initialOffset: number | null // where the learner had selected in the entry text, if anywhere
  onClose: () => void
}

const LABEL_LENGTH = 60
const key = (span: Span) => `${span.start}-${span.end}`

function label(sentence: string): string {
  const letters = Array.from(sentence)
  return letters.length > LABEL_LENGTH ? `${letters.slice(0, LABEL_LENGTH - 1).join('')}…` : sentence
}

// Read-only: nothing here edits the saved entry, so versions are copied, not applied.
export function SavedRephrase({ language, text, initialOffset, onClose }: SavedRephraseProps) {
  const headingId = useId()
  const toast = useToast()
  // Moving focus here scrolls the card into view and makes a screen reader say what opened.
  const focusSection = useFocusOnMount<HTMLElement>()
  const options = useMemo(() => sentenceSpans(text, language).filter((span) => isRephrasable(text.slice(span.start, span.end))), [text, language])
  const initial = options.find((span) => initialOffset !== null && initialOffset >= span.start && initialOffset <= span.end) ?? options[0]
  const [picked, setPicked] = useState(initial ? key(initial) : '')
  const span = options.find((option) => key(option) === picked)
  const server = span ? toServerSpan(text, span) : null
  const copy = (value: string) =>
    navigator.clipboard.writeText(value).then(
      () => toast.show({ message: 'Copied', tone: 'success' }),
      () => toast.show({ message: 'Couldn’t copy', tone: 'danger' }),
    )
  return (
    <Card as="section" ref={focusSection} tabIndex={-1} aria-labelledby={headingId} className="flex flex-col gap-3 p-4 outline-none md:p-4">
      {server ? (
        <>
          <Field label="Sentence" htmlFor={`${headingId}-sentence`}>
            <Select
              id={`${headingId}-sentence`}
              value={picked}
              onChange={setPicked}
              options={options.map((option) => ({ value: key(option), label: label(text.slice(option.start, option.end)) }))}
            />
          </Field>
          <RephraseCard request={{ language, ...server }} headingId={headingId} mode="read" onCopy={copy} />
        </>
      ) : (
        <p id={headingId} className="text-muted">
          No sentence here is long enough to rephrase (3 words or more).
        </p>
      )}
      <div>
        <Button onClick={onClose}>Close</Button>
      </div>
    </Card>
  )
}

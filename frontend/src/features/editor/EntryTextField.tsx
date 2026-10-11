import type { KeyboardEvent, Ref } from 'react'
import { Field } from '@/components/ui/Field'
import { CHIP_CLASS, HighlightedTextarea } from '@/components/ui/HighlightedTextarea'
import { MAX_ENTRY_CHARS } from '@/utils/constants'
import { pluralize } from '@/utils/formatter'
import { bracketRanges, countWords, entryLength } from '@/utils/text'
import { cn } from '@/utils/utils'

export interface EntryTextFieldProps {
  id: string
  label: string
  value: string
  onChange: (text: string) => void
  onSubmitShortcut: () => void
  readOnly?: boolean
  textareaRef?: Ref<HTMLTextAreaElement>
}

export function EntryTextField({ id, label, value, onChange, onSubmitShortcut, readOnly = false, textareaRef }: EntryTextFieldProps) {
  const hintId = `${id}-hint`
  const countId = `${id}-count`
  const overId = `${id}-over`
  const length = entryLength(value)
  const over = length - MAX_ENTRY_CHARS
  const chips = bracketRanges(value).map((range) => ({ ...range, className: CHIP_CLASS }))
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter confirms an IME candidate while composing; treating it as submit would send half-typed text.
    if (event.nativeEvent.isComposing || event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return
    event.preventDefault()
    onSubmitShortcut()
  }
  return (
    <Field label={label} htmlFor={id}>
      <HighlightedTextarea
        id={id}
        ref={textareaRef}
        value={value}
        decorations={chips}
        readOnly={readOnly}
        aria-describedby={over > 0 ? `${hintId} ${countId} ${overId}` : `${hintId} ${countId}`}
        aria-invalid={over > 0}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className="flex flex-wrap justify-between gap-2 text-sm text-muted">
        <p id={hintId}>Stuck on a word? Write it in English in [brackets] and the feedback will suggest it.</p>
        <p id={countId} className="flex gap-3">
          <span>{pluralize(countWords(value), 'word')}</span>
          <span className={cn(over > 0 && 'font-medium text-danger')}>{`${length} / ${MAX_ENTRY_CHARS}`}</span>
        </p>
      </div>
      {over > 0 && (
        <p id={overId} className="text-sm text-danger">
          {`${pluralize(over, 'character')} too long — shorten the entry to get feedback.`}
        </p>
      )}
    </Field>
  )
}

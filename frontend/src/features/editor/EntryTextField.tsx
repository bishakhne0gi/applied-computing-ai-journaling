import type { KeyboardEvent, Ref } from 'react'
import { Field } from '@/components/ui/Field'
import { Textarea } from '@/components/ui/Textarea'
import { MAX_ENTRY_CHARS } from '@/utils/constants'
import { pluralize } from '@/utils/formatter'
import { countWords } from '@/utils/text'

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
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return
    event.preventDefault()
    onSubmitShortcut()
  }
  return (
    <Field label={label} htmlFor={id}>
      <Textarea
        id={id}
        ref={textareaRef}
        value={value}
        readOnly={readOnly}
        maxLength={MAX_ENTRY_CHARS}
        aria-describedby={`${hintId} ${countId}`}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className="flex flex-wrap justify-between gap-2 text-sm text-muted">
        <p id={hintId}>Stuck on a word? Write it in English in [brackets] and the feedback will suggest it.</p>
        <p id={countId}>{pluralize(countWords(value), 'word')}</p>
      </div>
    </Field>
  )
}

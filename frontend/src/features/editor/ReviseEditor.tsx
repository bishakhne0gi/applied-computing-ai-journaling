import { useId, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useFocusOnMount } from '@/hooks/misc/useFocusOnMount'
import { toErrorMessage } from '@/utils/errorMessage'
import { EntryTextField } from './EntryTextField'
import { useReviseEntry } from './useReviseEntry'

export interface ReviseEditorProps {
  entryId: string
  initialText: string
  onDone: () => void
  onCancel: () => void
}

export function ReviseEditor({ entryId, initialText, onDone, onCancel }: ReviseEditorProps) {
  const [text, setText] = useState(initialText)
  const revise = useReviseEntry(entryId)
  const fieldId = useId()
  const focusRef = useFocusOnMount<HTMLTextAreaElement>()
  const canSubmit = text.trim() !== '' && !revise.isPending
  const submit = () => {
    if (canSubmit) revise.submit(text, onDone)
  }

  return (
    <form
      aria-label="Revise entry"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <EntryTextField id={fieldId} label="Revise your entry" value={text} onChange={setText} onSubmitShortcut={submit} readOnly={revise.isPending} textareaRef={focusRef} />
      {revise.error ? (
        <p role="alert" className="text-sm text-danger">
          {toErrorMessage(revise.error)}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" disabled={!canSubmit}>
          {revise.isPending ? 'Re-checking…' : 'Re-check'}
        </Button>
        <Button onClick={onCancel} disabled={revise.isPending}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

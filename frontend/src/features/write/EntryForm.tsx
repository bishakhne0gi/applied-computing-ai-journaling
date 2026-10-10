import { Button } from '@/components/ui/Button'
import { EntryTextField } from '@/features/editor/EntryTextField'
import { LanguageSelect } from '@/features/languages/LanguageSelect'
import { isSubmittableEntry } from '@/utils/text'
import { useFocusOnMount } from '@/hooks/misc/useFocusOnMount'
import type { WritePhase } from './useWriteSession'

const SUBMIT_LABELS: Record<WritePhase, string> = {
  editing: 'Get feedback',
  saving: 'Saving…',
  analyzing: 'Analyzing…',
  done: 'Get feedback',
}

export interface EntryFormProps {
  language: string
  onLanguageChange: (code: string) => void
  text: string
  onTextChange: (text: string) => void
  phase: WritePhase
  focusOnMount: boolean
  onSubmit: () => void
}

export function EntryForm({ language, onLanguageChange, text, onTextChange, phase, focusOnMount, onSubmit }: EntryFormProps) {
  const focusRef = useFocusOnMount<HTMLTextAreaElement>()
  const locked = phase !== 'editing'
  const canSubmit = !locked && language !== '' && isSubmittableEntry(text)
  const submit = () => {
    if (canSubmit) onSubmit()
  }

  return (
    <form
      aria-label="New journal entry"
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <div className="max-w-xs">
        <LanguageSelect id="entry-language" label="Language" value={language} onChange={onLanguageChange} disabled={locked} />
      </div>
      <EntryTextField id="entry-text" label="Your entry" value={text} onChange={onTextChange} onSubmitShortcut={submit} readOnly={locked} textareaRef={focusOnMount ? focusRef : undefined} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={!canSubmit}>
          {SUBMIT_LABELS[phase]}
        </Button>
        <p className="text-sm text-muted">or press ⌘/Ctrl + Enter</p>
      </div>
    </form>
  )
}

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { LanguageSelect } from '@/features/languages/LanguageSelect'
import { isSubmittableEntry } from '@/utils/text'
import { ComposerEditor } from './ComposerEditor'
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
  // The live status line; it sits beside the button so the outcome of pressing it reads in one place.
  status?: ReactNode
  focusOnMount: boolean
  onSubmit: () => void
}

export function EntryForm({ language, onLanguageChange, text, onTextChange, phase, status, focusOnMount, onSubmit }: EntryFormProps) {
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
      <ComposerEditor language={language} value={text} onChange={onTextChange} onSubmitShortcut={submit} readOnly={locked} focusOnMount={focusOnMount} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button type="submit" variant="primary" disabled={!canSubmit}>
          {SUBMIT_LABELS[phase]}
        </Button>
        {!locked && <p className="text-sm text-muted">or press ⌘/Ctrl + Enter</p>}
        <div className="sm:ml-auto">{status}</div>
      </div>
    </form>
  )
}

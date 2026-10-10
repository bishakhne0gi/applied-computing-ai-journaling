import type { WritePhase } from './useWriteSession'

const MESSAGES: Record<WritePhase, string> = {
  editing: '',
  saving: 'Saving…',
  analyzing: 'Saved. Analyzing…',
  done: 'Saved',
}

export interface WriteStatusProps {
  phase: WritePhase
  hasDraft: boolean
  draftPersisted: boolean
}

// Always rendered so screen readers hear each change; the fixed height avoids layout shift.
export function WriteStatus({ phase, hasDraft, draftPersisted }: WriteStatusProps) {
  const draftMessage = draftPersisted ? 'Draft kept on this device' : 'Draft not saved on this device'
  const message = phase === 'editing' && hasDraft ? draftMessage : MESSAGES[phase]
  return (
    <p role="status" className="min-h-5 text-sm text-muted">
      {message}
    </p>
  )
}

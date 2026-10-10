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
}

// Always rendered so screen readers hear each change; the fixed height avoids layout shift.
export function WriteStatus({ phase, hasDraft }: WriteStatusProps) {
  const message = phase === 'editing' && hasDraft ? 'Draft kept on this device' : MESSAGES[phase]
  return (
    <p role="status" className="min-h-5 text-sm text-muted">
      {message}
    </p>
  )
}

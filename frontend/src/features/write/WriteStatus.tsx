import { cn } from '@/utils/utils'
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

// Always rendered so screen readers hear each change. Progress is spoken only: the button label already shows it,
// and printing it twice beside the button would be noise.
export function WriteStatus({ phase, hasDraft, draftPersisted }: WriteStatusProps) {
  const draftMessage = draftPersisted ? 'Draft kept on this device' : 'Draft not saved on this device'
  const message = phase === 'editing' && hasDraft ? draftMessage : MESSAGES[phase]
  return (
    <p role="status" className={cn('text-sm text-muted', phase !== 'editing' && 'sr-only')}>
      {message}
    </p>
  )
}

import { Icon } from '@/components/ui/Icon'
import type { MistakeKind } from '@/types/analysis'
import { cn } from '@/utils/utils'

export interface CorrectionProps {
  original: string
  correction: string
  // Tints the original: an English word you didn't know is not an error.
  kind?: MistakeKind
  // For a narrow table cell that scrolls anyway; everywhere else the pills get the room.
  compact?: boolean
}

const originalTones: Record<MistakeKind, string> = {
  error: 'bg-danger-soft text-danger',
  suggestion: 'bg-warning-soft text-warning',
  vocab_help: 'bg-mark-vocab-bg text-mark-vocab',
}
// Never wraps: a long phrase truncates, and the title keeps the full text for a pointer.
const pillClass = 'inline-block truncate rounded-sm px-1.5 align-bottom whitespace-nowrap'

// The arrow is decorative; screen readers hear "... should be ..." instead.
export function Correction({ original, correction, kind = 'error', compact = false }: CorrectionProps) {
  const widthClass = compact ? 'max-w-28' : 'max-w-48'
  return (
    <>
      <span title={original} className={cn(pillClass, widthClass, originalTones[kind])}>{original}</span>{' '}
      <Icon name="arrowRight" className="inline size-4 align-middle text-muted" />
      {/* Spaces sit outside the spans: accessible-name computation trims them inside an inline element. */}
      <span className="sr-only">should be</span>{' '}
      <span title={correction} className={cn(pillClass, widthClass, 'bg-success-soft text-success')}>{correction}</span>
    </>
  )
}

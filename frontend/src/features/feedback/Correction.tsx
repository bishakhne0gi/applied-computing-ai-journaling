import { Icon } from '@/components/ui/Icon'
import type { MistakeKind } from '@/types/analysis'
import { cn } from '@/utils/utils'

export interface CorrectionProps {
  original: string
  correction: string
  // Tints the original: an English word you didn't know is not an error.
  kind?: MistakeKind
}

const originalTones: Record<MistakeKind, string> = {
  error: 'bg-danger-soft text-danger',
  suggestion: 'bg-warning-soft text-warning',
  vocab_help: 'bg-mark-vocab-bg text-mark-vocab',
}
// Never wraps: a long phrase truncates, and the title keeps the full text for a pointer.
const pillClass = 'inline-block max-w-28 truncate rounded-sm px-1.5 align-bottom whitespace-nowrap'

// The arrow is decorative; screen readers hear "... should be ..." instead.
export function Correction({ original, correction, kind = 'error' }: CorrectionProps) {
  return (
    <>
      <span title={original} className={cn(pillClass, originalTones[kind])}>{original}</span>{' '}
      <Icon name="arrowRight" className="inline size-4 align-middle text-muted" />
      {/* Spaces sit outside the spans: accessible-name computation trims them inside an inline element. */}
      <span className="sr-only">should be</span>{' '}
      <span title={correction} className={cn(pillClass, 'bg-success-soft text-success')}>{correction}</span>
    </>
  )
}

import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/utils/utils'

export interface RetryAnalysisButtonProps {
  label: string
  // Part of the accessible name so a list of identical "Retry analysis" buttons stays distinguishable.
  preview: string
  pending: boolean
  onRetry: () => void
}

// An icon beside the status pill, so every row keeps one meta line; the negative margins keep a 44px target without
// making that line taller or pushing the pill.
export function RetryAnalysisButton({ label, preview, pending, onRetry }: RetryAnalysisButtonProps) {
  const text = pending ? 'Analyzing…' : label
  return (
    <Button
      variant="icon"
      onClick={onRetry}
      disabled={pending}
      aria-label={`${text}: ${preview}`}
      title={text}
      className="relative -m-3 text-primary hover:bg-transparent hover:text-primary-pressed"
    >
      <Icon name={label === 'Get feedback' ? 'sparkle' : 'refresh'} className={cn('size-4', pending && 'motion-safe:animate-spin')} />
    </Button>
  )
}

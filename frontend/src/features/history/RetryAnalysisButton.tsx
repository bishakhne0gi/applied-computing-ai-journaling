import { Button } from '@/components/ui/Button'

export interface RetryAnalysisButtonProps {
  label: string
  // Part of the accessible name so a list of identical "Retry analysis" buttons stays distinguishable.
  preview: string
  pending: boolean
  onRetry: () => void
}

// Sits on the row's meta line: negative margins keep the 44px target without making the row taller.
export function RetryAnalysisButton({ label, preview, pending, onRetry }: RetryAnalysisButtonProps) {
  const text = pending ? 'Analyzing…' : label
  return (
    <Button
      variant="ghost"
      onClick={onRetry}
      disabled={pending}
      aria-label={`${text}: ${preview}`}
      className="relative -my-3 -mr-2 px-2 text-xs text-primary hover:bg-transparent hover:text-primary-pressed hover:underline"
    >
      {text}
    </Button>
  )
}

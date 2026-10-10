import { Button } from '@/components/ui/Button'

export interface ErrorStateProps {
  message: string
  onRetry: () => void
  retryLabel?: string
  retrying?: boolean
}

export function ErrorState({ message, onRetry, retryLabel = 'Try again', retrying = false }: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-md border border-danger bg-surface p-4 text-sm">
      <p>{message}</p>
      <Button onClick={onRetry} disabled={retrying}>
        {retryLabel}
      </Button>
    </div>
  )
}

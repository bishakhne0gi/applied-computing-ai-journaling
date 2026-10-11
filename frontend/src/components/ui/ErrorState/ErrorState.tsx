import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export interface ErrorStateProps {
  message: string
  onRetry: () => void
  retryLabel?: string
  retrying?: boolean
}

export function ErrorState({ message, onRetry, retryLabel = 'Try again', retrying = false }: ErrorStateProps) {
  return (
    <Card role="alert" className="flex flex-col items-start gap-3 border-danger p-4 text-sm shadow-none md:p-4">
      <p>{message}</p>
      <Button onClick={onRetry} disabled={retrying}>
        {retryLabel}
      </Button>
    </Card>
  )
}

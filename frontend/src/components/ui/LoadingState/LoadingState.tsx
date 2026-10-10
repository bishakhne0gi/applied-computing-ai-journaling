export interface LoadingStateProps {
  label: string
}

export function LoadingState({ label }: LoadingStateProps) {
  return (
    <div role="status" aria-busy="true" className="py-8 text-center text-sm text-muted">
      {label}
    </div>
  )
}

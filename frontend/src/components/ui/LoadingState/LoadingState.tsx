import type { ReactNode } from 'react'

export interface LoadingStateProps {
  label: string
  children?: ReactNode
}

// With skeletons the label is only for screen readers; the shapes show sighted users what is coming.
export function LoadingState({ label, children }: LoadingStateProps) {
  if (!children) {
    return (
      <div role="status" aria-busy="true" className="py-8 text-center text-sm text-muted">
        {label}
      </div>
    )
  }
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-3">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}

import type { ReactNode } from 'react'

export interface EmptyStateProps {
  title: string
  children?: ReactNode
}

export function EmptyState({ title, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-surface p-8 text-center">
      <p className="font-medium">{title}</p>
      {children}
    </div>
  )
}

import type { ReactNode } from 'react'

export interface EmptyStateProps {
  title: string
  children?: ReactNode
}

export function EmptyState({ title, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border p-8 text-center">
      <p className="font-medium">{title}</p>
      {children}
    </div>
  )
}

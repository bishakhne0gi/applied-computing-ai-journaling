import type { ReactNode } from 'react'

export interface InlineAlertProps {
  children: ReactNode
}

export function InlineAlert({ children }: InlineAlertProps) {
  return (
    <p role="alert" className="text-sm text-danger">
      {children}
    </p>
  )
}

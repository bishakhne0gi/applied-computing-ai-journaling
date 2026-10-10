import type { ReactNode } from 'react'

// tabIndex -1 lets the shell move focus here after a route change without adding a tab stop.
export function PageHeading({ children }: { children: ReactNode }) {
  return (
    <h1 tabIndex={-1} className="text-2xl font-bold">
      {children}
    </h1>
  )
}

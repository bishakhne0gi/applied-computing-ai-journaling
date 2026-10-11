import type { ReactNode, Ref } from 'react'

export interface PageHeadingProps {
  children: ReactNode
  ref?: Ref<HTMLHeadingElement>
}

// tabIndex -1 lets the workspace move focus here after a navigation without adding a tab stop.
export function PageHeading({ children, ref }: PageHeadingProps) {
  return (
    <h1 ref={ref} tabIndex={-1} className="text-3xl font-light tracking-tight text-fg">
      {children}
    </h1>
  )
}

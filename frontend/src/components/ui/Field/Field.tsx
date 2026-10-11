import type { ReactNode } from 'react'

export interface FieldProps {
  label: string
  htmlFor: string
  children: ReactNode
  // For a control whose context already says what it is (a filter right under its list's heading).
  hideLabel?: boolean
}

export function Field({ label, htmlFor, children, hideLabel = false }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label id={`${htmlFor}-label`} htmlFor={htmlFor} className={hideLabel ? 'sr-only' : 'text-sm font-medium text-fg-secondary'}>
        {label}
      </label>
      {children}
    </div>
  )
}

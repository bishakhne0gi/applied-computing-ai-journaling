import type { ComponentProps } from 'react'
import { cn } from '@/utils/utils'

export type TextareaProps = ComponentProps<'textarea'>

export function Textarea({ className, ...rest }: TextareaProps) {
  return (
    <textarea
      className={cn('min-h-48 w-full rounded-md border border-border bg-bg p-3 text-base leading-relaxed text-fg read-only:bg-surface', className)}
      {...rest}
    />
  )
}

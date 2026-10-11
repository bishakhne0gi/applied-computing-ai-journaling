import type { ComponentProps } from 'react'
import { cn } from '@/utils/utils'

export type TextareaProps = ComponentProps<'textarea'>

export function Textarea({ className, ...rest }: TextareaProps) {
  return (
    <textarea
      className={cn('min-h-48 w-full rounded-lg border border-border-input bg-bg p-4 text-base leading-relaxed text-fg shadow-sm read-only:bg-surface', className)}
      {...rest}
    />
  )
}

import type { ComponentProps } from 'react'
import { cn } from '@/utils/utils'

export type SelectProps = ComponentProps<'select'>

export function Select({ className, ...rest }: SelectProps) {
  return (
    <select
      className={cn('min-h-11 cursor-pointer rounded-md border border-border bg-bg px-3 text-sm text-fg disabled:cursor-not-allowed', className)}
      {...rest}
    />
  )
}

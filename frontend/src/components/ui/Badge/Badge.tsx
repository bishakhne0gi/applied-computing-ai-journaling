import type { ComponentProps } from 'react'
import { cn } from '@/utils/utils'

const toneClasses = {
  neutral: 'border-border text-muted',
  danger: 'border-danger text-danger',
  success: 'border-success text-success',
  warning: 'border-warning text-warning',
} as const

export interface BadgeProps extends ComponentProps<'span'> {
  tone?: keyof typeof toneClasses
}

export function Badge({ tone = 'neutral', className, ...rest }: BadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full border bg-surface px-2 py-0.5 text-xs font-medium', toneClasses[tone], className)}
      {...rest}
    />
  )
}

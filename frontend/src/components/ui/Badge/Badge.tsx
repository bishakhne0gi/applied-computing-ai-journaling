import type { ComponentProps } from 'react'
import { cn } from '@/utils/utils'

// Soft tinted pills: the tint carries the tone at a glance, the text colour carries it for contrast.
const toneClasses = {
  neutral: 'bg-neutral-soft text-fg-secondary',
  danger: 'bg-danger-soft text-danger',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
} as const

export interface BadgeProps extends ComponentProps<'span'> {
  tone?: keyof typeof toneClasses
}

export function Badge({ tone = 'neutral', className, ...rest }: BadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums', toneClasses[tone], className)}
      {...rest}
    />
  )
}

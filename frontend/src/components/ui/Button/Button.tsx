import type { ComponentProps } from 'react'
import { cn } from '@/utils/utils'

// Pills for actions, a round icon target, and the inline variant that sits inside running text (highlights).
const variants = {
  primary: 'min-h-11 rounded-full bg-primary px-5 text-sm font-medium text-primary-contrast shadow-sm hover:bg-primary-pressed',
  secondary: 'min-h-11 rounded-full border border-border-input bg-bg px-5 text-sm font-medium text-fg hover:border-primary hover:text-primary',
  ghost: 'min-h-11 rounded-full px-4 text-sm font-medium text-fg-secondary hover:bg-surface hover:text-fg',
  icon: 'size-11 shrink-0 rounded-full text-fg-secondary hover:bg-surface hover:text-fg',
  inline: 'inline rounded-sm px-0.5',
} as const

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: keyof typeof variants
}

export function Button({ variant = 'secondary', type = 'button', className, ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex cursor-pointer items-center justify-center gap-2 transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        className,
      )}
      {...rest}
    />
  )
}

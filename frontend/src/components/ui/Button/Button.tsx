import type { ComponentProps } from 'react'
import { cn } from '@/utils/utils'

// Pills for actions, a round icon target, and the inline variant that sits inside running text (highlights).
const variants = {
  primary: 'min-h-11 rounded-full bg-primary px-5 text-sm font-medium text-primary-contrast shadow-sm enabled:hover:bg-primary-pressed disabled:bg-primary-disabled disabled:opacity-100 disabled:shadow-none',
  secondary: 'min-h-11 rounded-full border border-border-input bg-bg px-5 text-sm font-medium text-fg hover:border-primary hover:text-primary',
  ghost: 'min-h-11 rounded-full px-4 text-sm font-medium text-fg-secondary hover:bg-surface hover:text-fg',
  icon: 'size-11 shrink-0 rounded-full text-fg-secondary hover:bg-surface hover:text-fg',
  tab: 'relative min-h-11 rounded-md px-5 text-sm font-medium text-muted transition-colors hover:text-fg aria-selected:text-primary',
  plain: 'rounded-sm',
  field: 'min-h-11 w-full justify-between rounded-md border border-border-input bg-bg px-3 text-left text-sm text-fg shadow-sm',
  inline: 'inline rounded-sm px-0.5',
  option: 'min-h-11 w-full justify-start rounded-md px-2 py-1 text-left text-base text-fg hover:bg-primary-soft',
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

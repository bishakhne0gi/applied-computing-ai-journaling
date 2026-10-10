import type { ComponentProps } from 'react'
import { cn } from '@/utils/utils'

const variants = {
  primary: 'min-h-11 bg-primary px-4 py-2 text-sm font-medium text-primary-contrast hover:opacity-90',
  secondary: 'min-h-11 border border-border bg-surface px-4 py-2 text-sm font-medium text-fg hover:bg-bg',
  ghost: 'min-h-11 px-3 py-2 text-sm font-medium text-fg hover:bg-surface',
  // Highlights sit inside running text, so they keep the text's size and line height.
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
        'inline-flex cursor-pointer items-center justify-center gap-2 rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        className,
      )}
      {...rest}
    />
  )
}

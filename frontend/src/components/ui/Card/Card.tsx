import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/utils/utils'

export interface CardProps extends ComponentPropsWithoutRef<'section'> {
  as?: 'div' | 'section'
  ref?: (node: HTMLElement | null) => void // a callback only: one ref type for both elements
}

export function Card({ as: Element = 'div', className, ...rest }: CardProps) {
  return <Element className={cn('rounded-lg border border-border bg-bg p-4 shadow-sm md:p-6', className)} {...rest} />
}

import type { ComponentProps } from 'react'
import { cn } from '@/utils/utils'

// Sections step down from PageHeading (3xl light) by size and colour, never by extra weight.
const levelClasses = {
  2: 'text-lg font-medium tracking-tight text-fg-secondary',
  3: 'text-base font-medium text-fg',
} as const

export interface SectionHeadingProps extends ComponentProps<'h2'> {
  level?: keyof typeof levelClasses
}

export function SectionHeading({ level = 2, className, ...rest }: SectionHeadingProps) {
  const Tag = level === 2 ? 'h2' : 'h3'
  return <Tag className={cn(levelClasses[level], className)} {...rest} />
}

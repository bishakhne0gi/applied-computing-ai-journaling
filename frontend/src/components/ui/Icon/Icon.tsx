import { cn } from '@/utils/utils'

// Inline strokes instead of an icon package: a handful of glyphs does not justify a dependency.
const PATHS = {
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7',
  alert: 'M12 8v5m0 3.5v.5M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  menu: 'M4 7h16M4 12h16M4 17h10',
  chart: 'M4 19V5m0 14h16M8 15l3-4 3 2 5-6',
  plus: 'M12 5v14M5 12h14',
  chevron: 'M6 9l6 6 6-6',
  info: 'M12 16v-4m0-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  refresh: 'M20 12a8 8 0 1 1-2.34-5.66L20 8.5M20 3.5v5h-5',
  sparkle: 'M12 3.5l1.9 5.1a1.5 1.5 0 0 0 .9.9l5.1 1.9-5.1 1.9a1.5 1.5 0 0 0-.9.9L12 19.3l-1.9-5.1a1.5 1.5 0 0 0-.9-.9L4.1 11.4l5.1-1.9a1.5 1.5 0 0 0 .9-.9z',
} as const

export type IconName = keyof typeof PATHS

export interface IconProps {
  name: IconName
  className?: string
}

export function Icon({ name, className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={cn('size-5 shrink-0', className)}>
      <path d={PATHS[name]} />
    </svg>
  )
}

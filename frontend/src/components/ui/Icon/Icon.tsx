import { cn } from '@/utils/utils'

// Inline strokes instead of an icon package: six glyphs do not justify a dependency.
const PATHS = {
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7',
  alert: 'M12 8v5m0 3.5v.5M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  menu: 'M4 7h16M4 12h16M4 17h10',
  chart: 'M4 19V5m0 14h16M8 15l3-4 3 2 5-6',
  plus: 'M12 5v14M5 12h14',
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

// Adapted from SmoothUI (MIT), https://smoothui.dev
import { m, useReducedMotion } from 'motion/react'
import type { KeyboardEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/utils/utils'
import { tabId, panelId } from './tabIds'

export interface AnimatedTab {
  id: string
  label: string
}

export interface AnimatedTabsProps {
  label: string
  idPrefix: string
  tabs: readonly AnimatedTab[]
  value: string
  onChange: (id: string) => void
}

const SPRING = { type: 'spring', bounce: 0.05, duration: 0.25 } as const
const columns: Record<number, string> = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }
const indicatorWidths: Record<number, string> = { 2: 'w-1/2', 3: 'w-1/3', 4: 'w-1/4' }
const KEY_STEPS: Record<string, (index: number, count: number) => number> = {
  ArrowRight: (index, count) => (index + 1) % count,
  ArrowLeft: (index, count) => (index - 1 + count) % count,
  Home: () => 0,
  End: (_index, count) => count - 1,
}

// One indicator slides by whole tab widths (a transform, so domAnimation is enough); SmoothUI's layoutId version
// would need the heavier domMax feature set.
export function AnimatedTabs({ label, idPrefix, tabs, value, onChange }: AnimatedTabsProps) {
  const reduce = useReducedMotion() ?? false
  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.id === value))
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = KEY_STEPS[event.key]
    const next = step && tabs[step(index, tabs.length)]
    if (!next) return
    event.preventDefault()
    onChange(next.id)
    document.getElementById(tabId(idPrefix, next.id))?.focus()
  }
  return (
    <div role="tablist" aria-label={label} className={cn('relative inline-grid rounded-full bg-surface p-1', columns[tabs.length])}>
      <span aria-hidden="true" className="pointer-events-none absolute inset-1">
        <m.span
          className={cn('block h-full rounded-full border border-border bg-bg shadow-sm', indicatorWidths[tabs.length])}
          initial={false}
          animate={{ x: `${activeIndex * 100}%` }}
          transition={reduce ? { duration: 0 } : SPRING}
        />
      </span>
      {tabs.map((tab, index) => {
        const selected = tab.id === value
        return (
          <Button
            key={tab.id}
            id={tabId(idPrefix, tab.id)}
            role="tab"
            variant="tab"
            aria-selected={selected}
            aria-controls={selected ? panelId(idPrefix, tab.id) : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {tab.label}
          </Button>
        )
      })}
    </div>
  )
}

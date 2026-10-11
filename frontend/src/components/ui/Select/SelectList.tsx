// Adapted from SmoothUI (MIT), https://smoothui.dev
import { m, useReducedMotion } from 'motion/react'
import { useEffect, type KeyboardEvent, type MouseEvent } from 'react'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/utils/utils'
import { optionId, type SelectOption } from './useSelectState'

const FADE = { duration: 0.15, ease: 'easeOut' } as const
const INSTANT = { duration: 0 } as const

export interface SelectListProps {
  selectId: string
  label?: string
  options: readonly SelectOption[]
  value: string
  active: number
  up: boolean
  onActive: (index: number) => void
  onChoose: (index: number) => void
  // Only reached if the list itself gets focus; normally focus (and every key) stays on the trigger.
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
}

function optionIndex(event: MouseEvent<HTMLElement>): number {
  const option = (event.target as HTMLElement).closest<HTMLElement>('[role="option"]')
  return option ? Number(option.dataset.index) : -1
}

export function SelectList({ selectId, label, options, value, active, up, onActive, onChoose, onKeyDown }: SelectListProps) {
  const reduce = useReducedMotion() ?? false
  const offset = up ? 4 : -4
  useEffect(() => {
    // jsdom has no scrollIntoView; real browsers keep the keyboard-active option in view.
    document.getElementById(optionId(selectId, active))?.scrollIntoView?.({ block: 'nearest' })
  }, [selectId, active])
  return (
    <m.ul
      id={`${selectId}-listbox`}
      role="listbox"
      aria-label={label}
      aria-labelledby={label ? undefined : `${selectId}-label`}
      tabIndex={-1}
      // Keeps focus (and the screen reader's place) on the trigger while the pointer picks or scrolls.
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => {
        const index = optionIndex(event)
        if (index >= 0) onChoose(index)
      }}
      onKeyDown={onKeyDown}
      className={cn(
        'absolute inset-x-0 z-dropdown flex max-h-60 flex-col gap-0.5 overflow-y-auto rounded-md border border-border bg-bg p-1 shadow-md',
        up ? 'bottom-full mb-1 origin-bottom' : 'top-full mt-1 origin-top',
      )}
      initial={reduce ? false : { opacity: 0, y: offset, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: offset, scale: 0.98 }}
      transition={reduce ? INSTANT : FADE}
    >
      {options.map((option, index) => (
        <li
          key={option.value}
          id={optionId(selectId, index)}
          role="option"
          aria-selected={option.value === value}
          data-index={index}
          onMouseMove={() => onActive(index)}
          className={cn(
            'flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-sm px-2.5 md:min-h-9 text-sm text-fg',
            index === active && 'bg-primary-soft text-primary',
          )}
        >
          <span className="truncate">{option.label}</span>
          {option.value === value && <Icon name="check" className="size-4 text-primary" />}
        </li>
      ))}
    </m.ul>
  )
}

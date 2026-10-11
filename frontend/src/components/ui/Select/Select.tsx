// Adapted from SmoothUI (MIT), https://smoothui.dev
import { AnimatePresence } from 'motion/react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/utils/utils'
import { SelectList } from './SelectList'
import { optionId, useSelectState, type SelectOption } from './useSelectState'

export type { SelectOption } from './useSelectState'

// Opens upward only when the space below can't fit the list (max-h-60 plus its gap) and above has more.
const LIST_ROOM = 248

export interface SelectProps {
  // Labelled by `<label for={id}>` (Field); the list is labelled by the element with id `${id}-label` unless
  // `aria-label` is given.
  id: string
  value: string
  options: readonly SelectOption[]
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

export function Select({ id, value, options, onChange, disabled = false, className, 'aria-label': label }: SelectProps) {
  const state = useSelectState(options, value, onChange)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [up, setUp] = useState(false)
  const selected = options.find((option) => option.value === value)
  const measure = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const below = window.innerHeight - rect.bottom
    setUp(below < LIST_ROOM && rect.top > below)
  }
  return (
    <div className={cn('relative', className)}>
      <Button
        ref={triggerRef}
        variant="field"
        id={id}
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={state.open}
        aria-controls={state.open ? `${id}-listbox` : undefined}
        aria-activedescendant={state.open ? optionId(id, state.active) : undefined}
        disabled={disabled}
        onClick={() => {
          measure()
          state.toggle()
        }}
        onKeyDown={(event) => {
          if (!state.open) measure()
          state.onKeyDown(event)
        }}
        onBlur={state.close}
      >
        <span className="truncate">{selected?.label ?? ''}</span>
        <Icon name="chevron" className={cn('size-4 text-muted transition-transform duration-150', state.open && 'rotate-180')} />
      </Button>
      <AnimatePresence>
        {state.open && (
          <SelectList selectId={id} label={label} options={options} value={value} active={state.active} up={up} onActive={state.setActive} onChoose={state.choose} onKeyDown={state.onKeyDown} />
        )}
      </AnimatePresence>
    </div>
  )
}

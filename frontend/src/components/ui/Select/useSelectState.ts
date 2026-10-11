import { useRef, useState, type KeyboardEvent } from 'react'

export interface SelectOption {
  value: string
  label: string
}

const TYPE_AHEAD_MS = 500
const PAGE = 10

// Type-ahead: the same letter typed again cycles through its matches; a longer run matches the whole prefix.
function matchIndex(options: readonly SelectOption[], query: string, from: number): number {
  const typed = query.toLocaleLowerCase()
  const repeated = [...typed].every((char) => char === typed[0])
  const needle = repeated ? (typed[0] ?? '') : typed
  const start = repeated ? from + 1 : from
  for (let step = 0; step < options.length; step += 1) {
    const index = (start + step) % options.length
    if (options[index]?.label.toLocaleLowerCase().startsWith(needle)) return index
  }
  return -1
}

export const optionId = (selectId: string, index: number) => `${selectId}-option-${index}`

interface KeyContext {
  active: number
  last: number
  selectedIndex: number
  openAt: (index: number) => void
  moveTo: (index: number) => void
  choose: (index: number) => void
}

function keyActions({ active, last, selectedIndex, openAt, moveTo, choose }: KeyContext) {
  const openOnSelected = () => openAt(selectedIndex)
  const closed: Record<string, () => void> = {
    ArrowDown: openOnSelected,
    ArrowUp: openOnSelected,
    Enter: openOnSelected,
    ' ': openOnSelected,
    Home: () => openAt(0),
    End: () => openAt(last),
  }
  const open: Record<string, () => void> = {
    ArrowDown: () => moveTo(active + 1),
    ArrowUp: () => moveTo(active - 1),
    PageDown: () => moveTo(active + PAGE),
    PageUp: () => moveTo(active - PAGE),
    Home: () => moveTo(0),
    End: () => moveTo(last),
    Enter: () => choose(active),
    ' ': () => choose(active),
  }
  return { closed, open }
}

const isPrintable = (event: KeyboardEvent) => event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey

// The WAI-APG select-only combobox keyboard model; focus never leaves the trigger.
export function useSelectState(options: readonly SelectOption[], value: string, onChange: (value: string) => void) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const typed = useRef({ text: '', at: 0 })
  const last = options.length - 1
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value))
  const clamp = (index: number) => Math.min(Math.max(index, 0), last)

  const openAt = (index: number) => {
    setActive(clamp(index))
    setOpen(true)
  }
  const choose = (index: number) => {
    const option = options[index]
    if (option && option.value !== value) onChange(option.value)
    setOpen(false)
  }
  const typeAhead = (key: string) => {
    const now = Date.now()
    const text = now - typed.current.at < TYPE_AHEAD_MS ? typed.current.text + key : key
    typed.current = { text, at: now }
    const index = matchIndex(options, text, open ? active : selectedIndex)
    if (index >= 0) openAt(index)
  }

  const keys = keyActions({ active, last, selectedIndex, openAt, moveTo: (index) => setActive(clamp(index)), choose })

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (open && event.key === 'Escape') {
      // Only an open list owns Escape; closed, it reaches an enclosing sheet or panel as usual.
      event.stopPropagation()
      setOpen(false)
    } else if (open && event.key === 'Tab') {
      setOpen(false)
    } else if (isPrintable(event)) {
      typeAhead(event.key)
    } else {
      const action = (open ? keys.open : keys.closed)[event.key]
      if (!action) return
      event.preventDefault()
      action()
    }
  }

  return {
    open,
    active,
    setActive,
    choose,
    onKeyDown,
    toggle: () => (open ? setOpen(false) : openAt(selectedIndex)),
    close: () => setOpen(false),
  }
}

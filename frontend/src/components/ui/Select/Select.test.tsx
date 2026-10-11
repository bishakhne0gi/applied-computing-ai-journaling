import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '@/components/ui/Button'
import { Select, type SelectOption } from '.'

const OPTIONS: SelectOption[] = [
  { value: '', label: 'All languages' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'fi', label: 'Finnish' },
]

function Harness({ initial = 'es', onChange = vi.fn() }: { initial?: string; onChange?: (value: string) => void }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <label htmlFor="lang" id="lang-label">
        Language
      </label>
      <Select
        id="lang"
        value={value}
        options={OPTIONS}
        onChange={(next) => {
          setValue(next)
          onChange(next)
        }}
      />
      <Button>After</Button>
    </>
  )
}

function setup(props?: Parameters<typeof Harness>[0]) {
  const user = userEvent.setup()
  render(<Harness {...props} />)
  return { user, combobox: screen.getByRole('combobox', { name: 'Language' }) }
}

const MANY: SelectOption[] = Array.from({ length: 25 }, (_, n) => ({ value: `v${n}`, label: `Option ${n}` }))

const activeOption = (combobox: HTMLElement) => document.getElementById(combobox.getAttribute('aria-activedescendant') ?? '')

describe('Select', () => {
  it('is a labelled, touch-sized combobox showing the selected label, closed by default', () => {
    // Arrange + Act
    const { combobox } = setup()
    // Assert
    expect(combobox).toHaveTextContent('Spanish')
    expect(combobox).toHaveAttribute('aria-expanded', 'false')
    expect(combobox).toHaveClass('min-h-11')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('opens on click with the selected option marked, and picks an option by click', async () => {
    // Arrange
    const onChange = vi.fn()
    const { user, combobox } = setup({ onChange })
    // Act
    await user.click(combobox)
    expect(screen.getByRole('listbox', { name: 'Language' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Spanish' })).toHaveAttribute('aria-selected', 'true')
    await user.click(screen.getByRole('option', { name: 'French' }))
    // Assert
    expect(onChange).toHaveBeenCalledWith('fr')
    expect(combobox).toHaveTextContent('French')
    expect(combobox).toHaveFocus()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('opens with ArrowDown on the selected option, moves with arrows, Home and End, and selects with Enter', async () => {
    // Arrange
    const { user, combobox } = setup()
    combobox.focus()
    // Act + Assert
    await user.keyboard('{ArrowDown}')
    expect(combobox).toHaveAttribute('aria-expanded', 'true')
    expect(activeOption(combobox)).toHaveTextContent('Spanish')
    await user.keyboard('{ArrowDown}')
    expect(activeOption(combobox)).toHaveTextContent('French')
    await user.keyboard('{End}')
    expect(activeOption(combobox)).toHaveTextContent('Finnish')
    await user.keyboard('{ArrowDown}')
    expect(activeOption(combobox)).toHaveTextContent('Finnish')
    await user.keyboard('{Home}')
    expect(activeOption(combobox)).toHaveTextContent('All languages')
    await user.keyboard('{ArrowUp}{ArrowDown}{ArrowDown}{Enter}')
    expect(combobox).toHaveTextContent('French')
    expect(combobox).toHaveAttribute('aria-expanded', 'false')
  })

  it('selects with Space and opens with Enter or ArrowUp', async () => {
    // Arrange
    const { user, combobox } = setup()
    combobox.focus()
    // Act + Assert
    await user.keyboard('{Enter}')
    expect(combobox).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard('{ArrowUp} ')
    expect(combobox).toHaveTextContent('All languages')
    await user.keyboard('{ArrowUp}')
    expect(combobox).toHaveAttribute('aria-expanded', 'true')
  })

  it('jumps by typing: the first letters move to the matching option, open or closed', async () => {
    // Arrange
    const { user, combobox } = setup()
    combobox.focus()
    // Act + Assert
    await user.keyboard('f')
    expect(combobox).toHaveAttribute('aria-expanded', 'true')
    expect(activeOption(combobox)).toHaveTextContent('French')
    await user.keyboard('i')
    expect(activeOption(combobox)).toHaveTextContent('Finnish')
  })

  it('gives every option a touch-sized row on phones, compact from md', async () => {
    // Arrange
    const { user, combobox } = setup()
    // Act
    await user.click(combobox)
    // Assert
    expect(screen.getByRole('option', { name: 'French' })).toHaveClass('min-h-11', 'md:min-h-9')
  })

  it('cycles through the matches when the same letter is typed again', async () => {
    // Arrange
    const { user, combobox } = setup()
    combobox.focus()
    // Act + Assert
    await user.keyboard('f')
    expect(activeOption(combobox)).toHaveTextContent('French')
    await user.keyboard('f')
    expect(activeOption(combobox)).toHaveTextContent('Finnish')
    await user.keyboard('f')
    expect(activeOption(combobox)).toHaveTextContent('French')
  })

  it('moves by ten with PageDown and PageUp and stops at the ends', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<Select id="m" aria-label="Many" value="v0" options={MANY} onChange={vi.fn()} />)
    const combobox = screen.getByRole('combobox', { name: 'Many' })
    combobox.focus()
    // Act + Assert
    await user.keyboard('{ArrowDown}{PageDown}')
    expect(activeOption(combobox)).toHaveTextContent('Option 10')
    await user.keyboard('{PageDown}{PageDown}')
    expect(activeOption(combobox)).toHaveTextContent('Option 24')
    await user.keyboard('{PageUp}')
    expect(activeOption(combobox)).toHaveTextContent('Option 14')
    await user.keyboard('{PageUp}{PageUp}')
    expect(activeOption(combobox)).toHaveTextContent('Option 0')
  })

  it('keeps aria-selected on the chosen option while arrowing, so it mirrors a native select', async () => {
    // Arrange
    const { user, combobox } = setup()
    combobox.focus()
    // Act
    await user.keyboard('{ArrowDown}{ArrowDown}')
    // Assert
    expect(activeOption(combobox)).toHaveTextContent('French')
    expect(activeOption(combobox)).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('option', { name: 'Spanish' })).toHaveAttribute('aria-selected', 'true')
  })

  it('opens upward when there is no room below and downward otherwise', async () => {
    // Arrange
    const user = userEvent.setup()
    const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect')
    render(<Select id="s" aria-label="Language" value="es" options={OPTIONS} onChange={vi.fn()} />)
    const combobox = screen.getByRole('combobox', { name: 'Language' })
    // Act + Assert
    rect.mockReturnValue({ top: 700, bottom: 740 } as DOMRect)
    await user.click(combobox)
    expect(screen.getByRole('listbox')).toHaveClass('bottom-full')
    await user.keyboard('{Escape}')
    rect.mockReturnValue({ top: 40, bottom: 80 } as DOMRect)
    await user.click(combobox)
    expect(screen.getByRole('listbox')).toHaveClass('top-full')
  })

  it('opens with Space and stays open, and a Space on an option picks it once', async () => {
    // Arrange
    const onChange = vi.fn()
    const { user, combobox } = setup({ onChange })
    combobox.focus()
    // Act
    await user.keyboard(' ')
    // Assert
    expect(combobox).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard('{ArrowDown} ')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('fr')
    expect(combobox).toHaveAttribute('aria-expanded', 'false')
  })

  it('cancels the click Firefox fires when Space is released', () => {
    // Arrange
    const { combobox } = setup()
    // Act
    const notCancelled = fireEvent.keyUp(combobox, { key: ' ' })
    // Assert
    expect(notCancelled).toBe(false)
  })

  it('closes on Escape without changing the value or letting the key reach an enclosing dialog', async () => {
    // Arrange
    // A native listener above React's root stands in for an enclosing sheet's Escape handling.
    const onParentKey = vi.fn()
    const listener = (event: KeyboardEvent) => onParentKey(event.key)
    document.body.addEventListener('keydown', listener)
    const user = userEvent.setup()
    render(<Select id="s" aria-label="Language" value="es" options={OPTIONS} onChange={vi.fn()} />)
    const combobox = screen.getByRole('combobox', { name: 'Language' })
    await user.click(combobox)
    // Act
    await user.keyboard('{ArrowDown}{Escape}')
    // Assert
    expect(combobox).toHaveAttribute('aria-expanded', 'false')
    expect(combobox).toHaveTextContent('Spanish')
    expect(onParentKey).not.toHaveBeenCalledWith('Escape')
    await user.keyboard('{Escape}')
    expect(onParentKey).toHaveBeenCalledWith('Escape')
    document.body.removeEventListener('keydown', listener)
  })

  it('closes without selecting when Tab moves on or the learner clicks elsewhere', async () => {
    // Arrange
    const onChange = vi.fn()
    const { user, combobox } = setup({ onChange })
    await user.click(combobox)
    // Act + Assert
    await user.keyboard('{ArrowDown}{Tab}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus()
    await user.click(combobox)
    await user.click(document.body)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not open while disabled', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<Select id="s" aria-label="Language" value="es" options={OPTIONS} onChange={vi.fn()} disabled />)
    // Act
    await user.click(screen.getByRole('combobox', { name: 'Language' }))
    // Assert
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})

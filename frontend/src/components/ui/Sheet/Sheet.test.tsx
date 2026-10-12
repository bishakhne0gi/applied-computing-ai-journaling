import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Button } from '@/components/ui/Button'
import { Sheet } from '.'

function Harness({ onDocumentEscape }: { onDocumentEscape?: () => void }) {
  const [open, setOpen] = useState(false)
  const outside = useRef<HTMLButtonElement>(null)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open insights</Button>
      <Button ref={outside} onClick={onDocumentEscape}>Outside</Button>
      <Sheet open={open} onClose={() => setOpen(false)} side="right" title="Insights" description="How you are doing.">
        <p>Some context</p>
        <Button>First</Button>
        <Button
          onClick={() => {
            outside.current?.focus()
            setOpen(false)
          }}
        >
          Move on
        </Button>
      </Sheet>
    </>
  )
}

async function openSheet() {
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getByRole('button', { name: 'Open insights' }))
  return user
}

describe('Sheet', () => {
  afterEach(() => vi.restoreAllMocks())

  it('is a named, described modal dialog that moves focus to its heading', async () => {
    // Arrange + Act
    await openSheet()
    // Assert
    const dialog = screen.getByRole('dialog', { name: 'Insights' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleDescription('How you are doing.')
    expect(screen.getByRole('heading', { level: 2, name: 'Insights' })).toHaveFocus()
  })

  it('keeps its title bar above the scrolling content, including positioned controls', async () => {
    // Arrange / Act
    await openSheet()
    // Assert
    expect(screen.getByRole('heading', { name: 'Insights' }).closest('.sticky')).toHaveClass('z-sticky')
  })

  it('closes on Escape and returns focus to the button that opened it', async () => {
    // Arrange
    const user = await openSheet()
    // Act
    await user.keyboard('{Escape}')
    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open insights' })).toHaveFocus()
  })

  it('closes from its Close button', async () => {
    // Arrange
    const user = await openSheet()
    // Act
    await user.click(screen.getByRole('button', { name: 'Close' }))
    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes when the backdrop is clicked', async () => {
    // Arrange
    const user = await openSheet()
    // The scrim is decorative (role="presentation"), so it has no accessible handle to query by.
    const scrim = document.querySelector('.bg-scrim')
    // Act
    if (scrim) await user.click(scrim)
    // Assert
    expect(scrim).not.toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps Tab and Shift+Tab inside the dialog', async () => {
    // Arrange
    const user = await openSheet()
    // Act + Assert
    await user.tab()
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
    await user.tab()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Move on' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Move on' })).toHaveFocus()
  })

  it('does not pull focus back when something outside took it while closing', async () => {
    // Arrange
    const user = await openSheet()
    // Act
    await user.click(screen.getByRole('button', { name: 'Move on' }))
    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Outside' })).toHaveFocus()
  })

  it('lets Escape close only the sheet, not handlers listening behind it', async () => {
    // Arrange
    const behind = vi.fn()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') behind()
    }
    document.addEventListener('keydown', onKeyDown)
    const user = await openSheet()
    // Act
    await user.keyboard('{Escape}')
    document.removeEventListener('keydown', onKeyDown)
    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(behind).not.toHaveBeenCalled()
  })

  it('locks page scroll while open', async () => {
    // Arrange
    const user = await openSheet()
    expect(document.body).toHaveClass('overflow-hidden')
    // Act
    await user.keyboard('{Escape}')
    // Assert
    expect(document.body).not.toHaveClass('overflow-hidden')
  })

  it('starts off-screen on its own side so it can slide in', async () => {
    // Arrange + Act
    await openSheet()
    // Assert
    expect(screen.getByRole('dialog').getAttribute('style')).toContain('translateX(100%)')
  })

  it('keeps Escape and the Tab trap working after a click on non-focusable content', async () => {
    // Arrange
    const user = await openSheet()
    await user.click(screen.getByText('Some context'))
    // Act + Assert
    await user.tab()
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement)
    await user.click(screen.getByText('Some context'))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps the page locked until the last of two overlapping sheets closes', async () => {
    // Arrange
    function Two() {
      const [a, setA] = useState(true)
      const [b, setB] = useState(true)
      return (
        <>
          <Sheet open={a} onClose={() => setA(false)} side="left" title="Entries">
            <p>A</p>
          </Sheet>
          <Sheet open={b} onClose={() => setB(false)} side="right" title="Insights">
            <p>B</p>
          </Sheet>
        </>
      )
    }
    const user = userEvent.setup()
    render(<Two />)
    // Act
    await user.keyboard('{Escape}')
    // Assert
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(document.body).toHaveClass('overflow-hidden')
    await user.keyboard('{Escape}')
    expect(document.body).not.toHaveClass('overflow-hidden')
  })
})

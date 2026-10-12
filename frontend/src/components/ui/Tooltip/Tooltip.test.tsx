import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Sheet } from '@/components/ui/Sheet'
import { Tooltip } from '.'

const HINT = 'Counts towards your error rate.'

function renderTooltip() {
  render(
    <Tooltip content={HINT}>
      <span>Error</span>
    </Tooltip>,
  )
  return { user: userEvent.setup(), trigger: screen.getByText('Error').parentElement as HTMLElement }
}

describe('Tooltip', () => {
  it('describes its trigger while focused and hides on blur', async () => {
    // Arrange
    const { user, trigger } = renderTooltip()
    // Act
    await user.tab()
    // Assert
    expect(trigger).toHaveFocus()
    expect(screen.getByRole('tooltip')).toHaveAttribute('data-state', 'open')
    expect(trigger).toHaveAccessibleDescription(HINT)
    await user.tab()
    expect(screen.getByRole('tooltip')).toHaveAttribute('data-state', 'closed')
  })

  it('keeps the hint described to screen readers while closed', () => {
    // Arrange + Act
    const { trigger } = renderTooltip()
    // Assert
    expect(screen.getByRole('tooltip')).toHaveAttribute('data-state', 'closed')
    expect(trigger).toHaveAccessibleDescription(HINT)
  })

  it('stays open while the pointer moves onto the tip', async () => {
    // Arrange
    const { user, trigger } = renderTooltip()
    await user.hover(trigger)
    // Act
    await user.hover(screen.getByRole('tooltip'))
    // Assert
    expect(screen.getByRole('tooltip')).toHaveAttribute('data-state', 'open')
    expect(screen.getByRole('tooltip')).not.toHaveClass('pointer-events-none')
  })

  it('opens outside a scrolling container, so the container can never clip it', async () => {
    // Arrange
    render(
      <div data-testid="scroller" className="overflow-y-auto">
        <Tooltip content={HINT} size="card">
          <span>Why</span>
        </Tooltip>
      </div>,
    )
    const user = userEvent.setup()
    // Act
    await user.hover(screen.getByText('Why'))
    // Assert
    const tip = screen.getByRole('tooltip')
    expect(tip).toHaveAttribute('data-state', 'open')
    expect(screen.getByTestId('scroller')).not.toContainElement(tip)
    expect(screen.getByRole('button', { name: 'Why' })).toHaveAccessibleDescription(HINT)
  })

  it('has a touch-sized trigger', () => {
    // Arrange + Act
    const { trigger } = renderTooltip()
    // Assert
    expect(trigger).toHaveClass('min-h-11', 'md:min-h-9')
  })

  it('shifts back inside the viewport when it would overflow the left edge', async () => {
    // Arrange
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: -20, right: 172, top: 0, bottom: 0, width: 192, height: 0, x: -20, y: 0, toJSON: () => ({}) })
    const { user, trigger } = renderTooltip()
    // Act
    await user.hover(trigger)
    // Assert
    expect(screen.getByRole('tooltip').parentElement).toHaveStyle({ left: '28px' })
    rect.mockRestore()
  })

  it('shows on hover and hides when the pointer leaves', async () => {
    // Arrange
    const { user, trigger } = renderTooltip()
    // Act
    await user.hover(trigger)
    // Assert
    expect(screen.getByRole('tooltip')).toHaveTextContent(HINT)
    await user.unhover(trigger)
    expect(screen.getByRole('tooltip')).toHaveAttribute('data-state', 'closed')
  })

  it('hides on Escape without moving focus', async () => {
    // Arrange
    const { user, trigger } = renderTooltip()
    await user.tab()
    // Act
    await user.keyboard('{Escape}')
    // Assert
    expect(screen.getByRole('tooltip')).toHaveAttribute('data-state', 'closed')
    expect(trigger).toHaveFocus()
  })

  it('is a button, and a click toggles the hint', async () => {
    // Arrange
    const { user, trigger } = renderTooltip()
    expect(trigger.tagName).toBe('BUTTON')
    // Act + Assert
    await user.click(trigger)
    expect(trigger).toHaveAccessibleDescription(HINT)
    await user.click(trigger)
    expect(screen.getByRole('tooltip')).toHaveAttribute('data-state', 'closed')
  })

  it('hides on Escape without closing an enclosing sheet; a second Escape closes the sheet', async () => {
    // Arrange
    const user = userEvent.setup()
    function InSheet() {
      const [open, setOpen] = useState(true)
      return (
        <Sheet open={open} onClose={() => setOpen(false)} side="right" title="Insights">
          <Tooltip content={HINT}>
            <span>Error</span>
          </Tooltip>
        </Sheet>
      )
    }
    render(<InSheet />)
    const trigger = screen.getByText('Error').parentElement as HTMLElement
    await user.click(trigger)
    trigger.focus()
    expect(screen.getByRole('tooltip')).toHaveAttribute('data-state', 'open')
    // Act
    await user.keyboard('{Escape}')
    // Assert
    expect(screen.getByRole('tooltip')).toHaveAttribute('data-state', 'closed')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

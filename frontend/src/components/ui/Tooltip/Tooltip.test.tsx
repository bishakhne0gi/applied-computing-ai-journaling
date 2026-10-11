import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
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
    expect(screen.getByRole('tooltip')).toHaveTextContent(HINT)
    expect(trigger).toHaveAccessibleDescription(HINT)
    await user.tab()
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('shows on hover and hides when the pointer leaves', async () => {
    // Arrange
    const { user, trigger } = renderTooltip()
    // Act
    await user.hover(trigger)
    // Assert
    expect(screen.getByRole('tooltip')).toHaveTextContent(HINT)
    await user.unhover(trigger)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('hides on Escape without moving focus', async () => {
    // Arrange
    const { user, trigger } = renderTooltip()
    await user.tab()
    // Act
    await user.keyboard('{Escape}')
    // Assert
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
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
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
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
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    // Act
    await user.keyboard('{Escape}')
    // Assert
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

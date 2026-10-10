import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '.'

describe('Button', () => {
  it('never submits a form by accident', () => {
    // Arrange
    const label = 'Save'
    // Act
    render(<Button>{label}</Button>)
    // Assert
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button')
  })

  it('applies the chosen variant and keeps the pointer cursor', () => {
    // Arrange
    const variant = 'primary'
    // Act
    render(<Button variant={variant}>Go</Button>)
    // Assert
    expect(screen.getByRole('button', { name: 'Go' })).toHaveClass('bg-primary', 'cursor-pointer', 'min-h-11')
  })

  it('does not fire when disabled', async () => {
    // Arrange
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Go
      </Button>,
    )
    // Act
    await userEvent.setup().click(screen.getByRole('button', { name: 'Go' }))
    // Assert
    expect(onClick).not.toHaveBeenCalled()
  })
})

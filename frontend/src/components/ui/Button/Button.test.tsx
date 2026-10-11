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

  it('has an option variant: a full-width, left-aligned row that tints on hover', () => {
    // Arrange + Act
    render(<Button variant="option">Pick me</Button>)
    // Assert
    expect(screen.getByRole('button', { name: 'Pick me' })).toHaveClass('w-full', 'justify-start', 'text-left', 'hover:bg-primary-soft')
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
  it('is a pill in its filled and outlined variants', () => {
    // Arrange
    render(
      <>
        <Button variant="primary">Save</Button>
        <Button>Cancel</Button>
      </>,
    )
    // Act
    const buttons = screen.getAllByRole('button')
    // Assert
    for (const button of buttons) expect(button).toHaveClass('rounded-full')
  })

  it('gives icon buttons a round touch-sized target', () => {
    // Arrange
    const label = 'Close'
    // Act
    render(<Button variant="icon" aria-label={label}>×</Button>)
    // Assert
    expect(screen.getByRole('button', { name: 'Close' })).toHaveClass('size-11', 'rounded-full', 'cursor-pointer')
  })
})

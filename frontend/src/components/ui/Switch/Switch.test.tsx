import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Switch } from '.'

describe('Switch', () => {
  it('is a named switch that reports the flipped value', async () => {
    // Arrange
    const onChange = vi.fn()
    render(<Switch label="Live hints" checked onChange={onChange} />)
    // Act
    await userEvent.setup().click(screen.getByRole('switch', { name: 'Live hints' }))
    // Assert
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    expect(onChange).toHaveBeenCalledWith(false)
  })
})

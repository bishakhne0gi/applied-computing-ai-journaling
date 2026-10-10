import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ErrorState } from '.'

describe('ErrorState', () => {
  it('announces the message and retries on request', async () => {
    // Arrange
    const onRetry = vi.fn()
    render(<ErrorState message="Could not load." onRetry={onRetry} />)
    // Act
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))
    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load.')
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('disables its button while a retry is running', () => {
    // Arrange
    const retrying = true
    // Act
    render(<ErrorState message="Failed." onRetry={vi.fn()} retryLabel="Retrying…" retrying={retrying} />)
    // Assert
    expect(screen.getByRole('button', { name: 'Retrying…' })).toBeDisabled()
  })
})

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LoadingState } from '.'

describe('LoadingState', () => {
  it('announces what is loading as a busy status', () => {
    // Arrange
    const label = 'Loading entries…'
    // Act
    render(<LoadingState label={label} />)
    // Assert
    expect(screen.getByRole('status')).toHaveTextContent(label)
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  })
})

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

  it('shows placeholders and keeps the label for screen readers', () => {
    // Arrange
    const label = 'Loading entries…'
    // Act
    render(
      <LoadingState label={label}>
        <span>placeholder</span>
      </LoadingState>,
    )
    // Assert
    expect(screen.getByRole('status')).toHaveTextContent(label)
    expect(screen.getByText(label)).toHaveClass('sr-only')
    expect(screen.getByText('placeholder')).toBeInTheDocument()
  })
})

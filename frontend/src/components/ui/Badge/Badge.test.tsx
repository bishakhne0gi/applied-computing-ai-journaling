import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Badge } from '.'

describe('Badge', () => {
  it('shows its label in the chosen tone', () => {
    // Arrange
    const tone = 'danger'
    // Act
    render(<Badge tone={tone}>2 errors</Badge>)
    // Assert
    expect(screen.getByText('2 errors')).toHaveClass('text-danger')
  })

  it('defaults to the neutral tone', () => {
    // Arrange
    const label = 'Verb conjugation'
    // Act
    render(<Badge>{label}</Badge>)
    // Assert
    expect(screen.getByText(label)).toHaveClass('text-muted')
  })
})

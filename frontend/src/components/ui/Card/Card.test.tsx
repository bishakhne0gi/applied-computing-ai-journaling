import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Card } from '.'

describe('Card', () => {
  it('renders the element it is asked for on the card surface', () => {
    // Arrange
    const label = 'Progress'
    // Act
    render(<Card as="section" aria-label={label}>Body</Card>)
    // Assert
    expect(screen.getByRole('region', { name: 'Progress' })).toHaveClass('rounded-lg', 'border-border', 'bg-bg')
  })

  it('is a plain block by default and lets callers override its classes', () => {
    // Arrange
    const extra = 'bg-surface'
    // Act
    render(<Card className={extra}>Body</Card>)
    // Assert
    const card = screen.getByText('Body')
    expect(card.tagName).toBe('DIV')
    expect(card).toHaveClass('bg-surface')
    expect(card).not.toHaveClass('bg-bg')
  })
})

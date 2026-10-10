import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmptyState } from '.'

describe('EmptyState', () => {
  it('shows the title and the next useful action', () => {
    // Arrange
    const action = <a href="/">Write your first entry</a>
    // Act
    render(<EmptyState title="No entries yet">{action}</EmptyState>)
    // Assert
    expect(screen.getByText('No entries yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Write your first entry' })).toBeInTheDocument()
  })
})

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { TextLink } from '.'

describe('TextLink', () => {
  it('renders a router link to its target', () => {
    // Arrange
    const to = '/entries'
    // Act
    render(
      <MemoryRouter>
        <TextLink to={to}>History</TextLink>
      </MemoryRouter>,
    )
    // Assert
    expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute('href', '/entries')
  })

  it('lets callers add classes after its own', () => {
    // Arrange
    const extra = 'text-sm'
    // Act
    render(
      <MemoryRouter>
        <TextLink to="/" className={extra}>
          Home
        </TextLink>
      </MemoryRouter>,
    )
    // Assert
    expect(screen.getByRole('link', { name: 'Home' })).toHaveClass('text-primary', 'text-sm')
  })
})

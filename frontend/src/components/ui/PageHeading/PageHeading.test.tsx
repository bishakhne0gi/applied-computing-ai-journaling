import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PageHeading } from '.'

describe('PageHeading', () => {
  it('is a level-one heading that can take programmatic focus but is not a tab stop', () => {
    // Arrange
    render(<PageHeading>History</PageHeading>)
    // Act
    const heading = screen.getByRole('heading', { level: 1, name: 'History' })
    // Assert
    expect(heading).toHaveAttribute('tabindex', '-1')
  })
})

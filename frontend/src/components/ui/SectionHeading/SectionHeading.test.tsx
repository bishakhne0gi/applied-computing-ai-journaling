import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SectionHeading } from '.'

describe('SectionHeading', () => {
  it('is a quieter level-two heading by default, a step below the light page title', () => {
    // Arrange + Act
    render(<SectionHeading>Feedback</SectionHeading>)
    // Assert
    expect(screen.getByRole('heading', { level: 2, name: 'Feedback' })).toHaveClass('font-medium', 'text-fg-secondary')
  })

  it('renders a level-three heading and passes native props through', () => {
    // Arrange + Act
    render(
      <SectionHeading level={3} id="notes" tabIndex={-1}>
        Other notes
      </SectionHeading>,
    )
    // Assert
    expect(screen.getByRole('heading', { level: 3, name: 'Other notes' })).toHaveAttribute('id', 'notes')
  })
})

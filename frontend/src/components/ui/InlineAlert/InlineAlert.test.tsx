import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { InlineAlert } from '.'

describe('InlineAlert', () => {
  it('announces its message as an alert in the danger colour', () => {
    // Arrange + Act
    render(<InlineAlert>Could not save.</InlineAlert>)
    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save.')
    expect(screen.getByRole('alert')).toHaveClass('text-danger')
  })
})

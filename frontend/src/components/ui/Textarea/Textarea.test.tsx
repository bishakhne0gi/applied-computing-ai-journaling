import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Textarea } from '.'

describe('Textarea', () => {
  it('passes native props through', () => {
    // Arrange
    const maxLength = 10
    // Act
    render(<Textarea aria-label="Entry" maxLength={maxLength} readOnly />)
    // Assert
    expect(screen.getByRole('textbox', { name: 'Entry' })).toHaveAttribute('maxlength', '10')
    expect(screen.getByRole('textbox')).toHaveAttribute('readonly')
  })
})

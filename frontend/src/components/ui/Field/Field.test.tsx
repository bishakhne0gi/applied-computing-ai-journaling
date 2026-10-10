import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Field } from '.'

describe('Field', () => {
  it('labels the control it wraps', () => {
    // Arrange
    const label = 'Your entry'
    // Act
    render(
      <Field label={label} htmlFor="entry">
        <input id="entry" />
      </Field>,
    )
    // Assert
    expect(screen.getByRole('textbox', { name: 'Your entry' })).toBeInTheDocument()
  })
})

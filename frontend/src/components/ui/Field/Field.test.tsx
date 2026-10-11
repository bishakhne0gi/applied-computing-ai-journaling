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

  it('can hide its label visually and keep it as the accessible name', () => {
    // Arrange + Act
    render(
      <Field label="Filter by language" htmlFor="filter" hideLabel>
        <select id="filter" />
      </Field>,
    )
    // Assert
    expect(screen.getByText('Filter by language')).toHaveClass('sr-only')
    expect(screen.getByRole('combobox', { name: 'Filter by language' })).toBeInTheDocument()
  })
})

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Select } from '.'

describe('Select', () => {
  it('renders a native select with its options and a touch-sized box', () => {
    // Arrange
    const options = ['es', 'fr']
    // Act
    render(
      <Select aria-label="Language" defaultValue="fr">
        {options.map((code) => (
          <option key={code} value={code}>
            {code}
          </option>
        ))}
      </Select>,
    )
    // Assert
    expect(screen.getByRole('combobox', { name: 'Language' })).toHaveValue('fr')
    expect(screen.getByRole('combobox')).toHaveClass('min-h-11')
  })
})

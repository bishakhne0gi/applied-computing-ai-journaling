import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Icon } from '.'

describe('Icon', () => {
  it('is decorative, so the control around it carries the name', () => {
    // Arrange
    const name = 'close'
    // Act
    const { container } = render(<Icon name={name} />)
    // Assert
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
})

import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Skeleton } from '.'

describe('Skeleton', () => {
  it('is a decorative pulsing block sized by its caller', () => {
    // Arrange
    const size = 'h-14'
    // Act
    const { container } = render(<Skeleton className={size} />)
    // Assert
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
    expect(container.firstChild).toHaveClass('animate-pulse', 'h-14')
  })
})

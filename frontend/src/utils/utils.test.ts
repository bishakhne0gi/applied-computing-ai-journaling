import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('lets a later class override an earlier one so primitives accept className overrides', () => {
    // Arrange
    const base = 'px-4 text-sm'
    // Act
    const merged = cn(base, false, 'px-2')
    // Assert
    expect(merged).toBe('text-sm px-2')
  })
})

describe('cn with custom tokens', () => {
  it('lets a caller override the layer and width tokens instead of keeping both', () => {
    // Arrange
    const base = 'z-overlay max-w-content'
    // Act
    const merged = cn(base, 'z-toast max-w-full')
    // Assert
    expect(merged).toBe('z-toast max-w-full')
  })
})

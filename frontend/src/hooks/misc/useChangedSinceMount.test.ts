import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useChangedSinceMount } from './useChangedSinceMount'

describe('useChangedSinceMount', () => {
  it('is false on mount and while the value stays the same', () => {
    // Arrange
    const { result, rerender } = renderHook(({ value }) => useChangedSinceMount(value), { initialProps: { value: 'a' } })
    // Act
    rerender({ value: 'a' })
    // Assert
    expect(result.current).toBe(false)
  })

  it('turns true on the first change and stays true even if the value comes back', () => {
    // Arrange
    const { result, rerender } = renderHook(({ value }) => useChangedSinceMount(value), { initialProps: { value: 'a' } })
    // Act
    rerender({ value: 'b' })
    const afterChange = result.current
    rerender({ value: 'a' })
    // Assert
    expect(afterChange).toBe(true)
    expect(result.current).toBe(true)
  })
})

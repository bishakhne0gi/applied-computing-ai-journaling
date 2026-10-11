import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedValue } from './useDebouncedValue'

describe('useDebouncedValue', () => {
  afterEach(() => vi.useRealTimers())

  it('starts at the current value, so text already there is checked at once', () => {
    // Arrange + Act
    const { result } = renderHook(() => useDebouncedValue('Hola', 1200))
    // Assert
    expect(result.current).toBe('Hola')
  })

  it('follows the value only once it has stopped changing for the delay', () => {
    // Arrange
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 1200), { initialProps: { value: 'a' } })
    // Act
    rerender({ value: 'ab' })
    act(() => vi.advanceTimersByTime(1000))
    rerender({ value: 'abc' })
    act(() => vi.advanceTimersByTime(1000))
    const midway = result.current
    act(() => vi.advanceTimersByTime(200))
    // Assert
    expect(midway).toBe('a')
    expect(result.current).toBe('abc')
  })
})

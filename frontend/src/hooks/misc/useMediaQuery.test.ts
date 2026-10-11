import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMediaQuery } from './useMediaQuery'

function fakeMatchMedia(initial: boolean) {
  let matches = initial
  const listeners = new Set<() => void>()
  const list = {
    get matches() {
      return matches
    },
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  }
  vi.stubGlobal('matchMedia', () => list)
  return (next: boolean) => {
    matches = next
    for (const listener of listeners) listener()
  }
}

describe('useMediaQuery', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('answers the fallback where matchMedia does not exist', () => {
    // Arrange + Act
    const { result } = renderHook(() => useMediaQuery('(min-width: 64rem)', true))
    // Assert
    expect(result.current).toBe(true)
  })

  it('follows the media query as it changes', () => {
    // Arrange
    const change = fakeMatchMedia(false)
    const { result } = renderHook(() => useMediaQuery('(min-width: 64rem)', true))
    expect(result.current).toBe(false)
    // Act
    act(() => change(true))
    // Assert
    expect(result.current).toBe(true)
  })
})

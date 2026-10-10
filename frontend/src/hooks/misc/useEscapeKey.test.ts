import { fireEvent, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useEscapeKey } from './useEscapeKey'

describe('useEscapeKey', () => {
  it('calls the handler when Escape is pressed anywhere', () => {
    // Arrange
    const onEscape = vi.fn()
    renderHook(() => useEscapeKey(onEscape))
    // Act
    fireEvent.keyDown(document, { key: 'Escape' })
    // Assert
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  it('ignores other keys', () => {
    // Arrange
    const onEscape = vi.fn()
    renderHook(() => useEscapeKey(onEscape))
    // Act
    fireEvent.keyDown(document, { key: 'Enter' })
    // Assert
    expect(onEscape).not.toHaveBeenCalled()
  })

  it('stops listening once unmounted', () => {
    // Arrange
    const onEscape = vi.fn()
    const { unmount } = renderHook(() => useEscapeKey(onEscape))
    unmount()
    // Act
    fireEvent.keyDown(document, { key: 'Escape' })
    // Assert
    expect(onEscape).not.toHaveBeenCalled()
  })
})

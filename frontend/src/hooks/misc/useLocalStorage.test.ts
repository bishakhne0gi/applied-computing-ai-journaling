import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useLocalStorage } from './useLocalStorage'

describe('useLocalStorage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('starts from the stored value', () => {
    // Arrange
    localStorage.setItem('k', 'hola')
    // Act
    const { result } = renderHook(() => useLocalStorage('k'))
    // Assert
    expect(result.current[0]).toBe('hola')
  })

  it('stores every update', () => {
    // Arrange
    const { result } = renderHook(() => useLocalStorage('k'))
    // Act
    act(() => result.current[1]('adiós'))
    // Assert
    expect(result.current[0]).toBe('adiós')
    expect(localStorage.getItem('k')).toBe('adiós')
  })

  it('removes the key when the value is emptied', () => {
    // Arrange
    localStorage.setItem('k', 'hola')
    const { result } = renderHook(() => useLocalStorage('k'))
    // Act
    act(() => result.current[1](''))
    // Assert
    expect(localStorage.getItem('k')).toBeNull()
  })

  it('keeps working in memory when storage refuses to write', () => {
    // Arrange
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const { result } = renderHook(() => useLocalStorage('k'))
    // Act
    act(() => result.current[1]('hola'))
    // Assert
    expect(result.current[0]).toBe('hola')
  })

  it('reports whether the last write reached storage', () => {
    // Arrange
    const { result } = renderHook(() => useLocalStorage('k'))
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    // Act
    act(() => result.current[1]('hola'))
    const afterGoodWrite = result.current[2]
    setItem.mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    act(() => result.current[1]('adiós'))
    // Assert
    expect(afterGoodWrite).toBe(true)
    expect(result.current[2]).toBe(false)
  })

  it('recovers when a later write succeeds', () => {
    // Arrange
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('QuotaExceededError')
    })
    const { result } = renderHook(() => useLocalStorage('k'))
    act(() => result.current[1]('hola'))
    expect(result.current[2]).toBe(false)
    // Act
    act(() => result.current[1]('hola otra vez'))
    // Assert
    expect(setItem).toHaveBeenCalledTimes(2)
    expect(result.current[2]).toBe(true)
  })
})

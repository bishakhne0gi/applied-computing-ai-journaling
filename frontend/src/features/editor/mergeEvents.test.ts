import type { KeyboardEvent } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { mergeEvents } from './mergeEvents'

const keyEvent = (prevented: () => boolean) => ({ isDefaultPrevented: prevented }) as unknown as KeyboardEvent<HTMLTextAreaElement>

describe('mergeEvents', () => {
  it('calls every set in order', () => {
    // Arrange
    const calls: string[] = []
    const merged = mergeEvents({ onKeyDown: () => calls.push('a') }, { onKeyDown: () => calls.push('b') })
    // Act
    merged.onKeyDown?.(keyEvent(() => false))
    // Assert
    expect(calls).toEqual(['a', 'b'])
  })

  it('stops once a handler prevents the default', () => {
    // Arrange
    const second = vi.fn()
    let prevented = false
    const merged = mergeEvents({ onKeyDown: () => (prevented = true) }, { onKeyDown: second })
    // Act
    merged.onKeyDown?.(keyEvent(() => prevented))
    // Assert
    expect(second).not.toHaveBeenCalled()
  })

  it('passes through keys present in one set only', () => {
    // Arrange
    const onBlur = vi.fn()
    // Act
    const merged = mergeEvents({ onKeyDown: vi.fn() }, { onBlur })
    // Assert
    expect(merged.onBlur).toBeDefined()
    expect(merged.onClick).toBeUndefined()
  })
})

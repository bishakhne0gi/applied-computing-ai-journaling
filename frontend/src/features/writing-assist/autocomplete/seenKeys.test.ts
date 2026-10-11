import { describe, expect, it } from 'vitest'
import { MAX_SEEN, remember } from './seenKeys'

describe('remember', () => {
  it('keeps every key while under the cap', () => {
    // Arrange
    const seen = remember(remember(new Set<string>(), 'a'), 'b')
    // Assert
    expect([...seen]).toEqual(['a', 'b'])
  })

  it('forgets the oldest keys past the cap and never grows beyond it', () => {
    // Arrange
    let seen: ReadonlySet<string> = new Set()
    // Act
    for (let i = 0; i < MAX_SEEN + 10; i += 1) seen = remember(seen, `k${i}`)
    // Assert
    expect(seen.size).toBe(MAX_SEEN)
    expect(seen.has('k0')).toBe(false)
    expect(seen.has(`k${MAX_SEEN + 9}`)).toBe(true)
  })
})

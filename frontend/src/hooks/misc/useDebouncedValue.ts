import { useEffect, useState } from 'react'

// While paused (an IME composition is open) the pending value waits; it settles one delay after the pause ends.
export function useDebouncedValue<T>(value: T, delayMs: number, paused = false): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    if (paused) return
    const timer = setTimeout(() => setSettled(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs, paused])
  return settled
}

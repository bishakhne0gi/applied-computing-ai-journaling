import { useState } from 'react'

// Tells a deep link (leave focus alone) from the user moving around (focus what changed). Remembered in state, so
// going back to the first value still counts as "moved".
export function useChangedSinceMount(value: string): boolean {
  const [initial] = useState(value)
  const [changed, setChanged] = useState(false)
  const differs = value !== initial
  if (differs && !changed) setChanged(true)
  return changed || differs
}

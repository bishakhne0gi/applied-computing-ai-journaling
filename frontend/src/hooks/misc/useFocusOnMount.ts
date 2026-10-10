import { useCallback } from 'react'

// A stable callback ref runs once when the element mounts, so focus moves without an effect or a re-focus per render.
export function useFocusOnMount<T extends HTMLElement>(): (node: T | null) => void {
  return useCallback((node: T | null) => node?.focus(), [])
}

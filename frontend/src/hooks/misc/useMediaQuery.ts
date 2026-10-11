import { useCallback, useSyncExternalStore } from 'react'
import { DESKTOP_QUERY } from '@/utils/constants'

const supported = () => typeof window.matchMedia === 'function'

// `fallback` answers where matchMedia does not exist (jsdom), so component tests get the layout they exercise most.
export function useMediaQuery(query = DESKTOP_QUERY, fallback = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!supported()) return () => undefined
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )
  const snapshot = () => (supported() ? window.matchMedia(query).matches : fallback)
  return useSyncExternalStore(subscribe, snapshot, () => fallback)
}

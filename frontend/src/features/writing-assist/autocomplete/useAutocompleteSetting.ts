import { useLocalStorage } from '@/hooks/misc/useLocalStorage'
import { STORAGE_KEYS } from '@/utils/constants'

// On by default; only "off" is stored, so clearing storage turns ghost text back on.
export function useAutocompleteSetting(): [boolean, (on: boolean) => void] {
  const [stored, setStored] = useLocalStorage(STORAGE_KEYS.autocomplete)
  return [stored !== 'off', (on) => setStored(on ? '' : 'off')]
}

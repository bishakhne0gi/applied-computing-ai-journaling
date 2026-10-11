import { useLocalStorage } from '@/hooks/misc/useLocalStorage'
import { STORAGE_KEYS } from '@/utils/constants'

// On by default (spec §7.2); only "off" is stored, so clearing storage turns hints back on.
export function useLiveHintsSetting(): [boolean, (on: boolean) => void] {
  const [stored, setStored] = useLocalStorage(STORAGE_KEYS.liveHints)
  return [stored !== 'off', (on) => setStored(on ? '' : 'off')]
}

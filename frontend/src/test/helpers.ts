import { API_BASE } from '@/utils/constants'

export const apiUrl = (path: string) => `${API_BASE}${path}`

// The in-memory API reads `?mock=` from the window location; MemoryRouter never touches it.
export function setMockMode(mode: string): void {
  window.history.replaceState(null, '', `/?mock=${mode}`)
}

export function clearMockMode(): void {
  window.history.replaceState(null, '', '/')
}

// Absolute base URL: ky 2 resolves `baseUrl` with `new Request()`, which rejects relative URLs outside a browser (tests).
export const API_BASE: string = import.meta.env.VITE_API_BASE ?? `${location.origin}/api/v1/`

export const MAX_ENTRY_CHARS = 5000
export const PAGE_SIZE = 10
// Live hints wait for a pause in typing and for enough words to judge (spec §7.2).
export const LIVE_HINTS = { debounceMs: 1200, minWords: 3 } as const
export const STORAGE_KEYS = { draft: 'journal.draft', language: 'journal.language', liveHints: 'journal.liveHints' } as const

// Tailwind's `lg`: the sidebar sits beside the main column from here up, and becomes a sheet below it.
export const DESKTOP_QUERY = '(min-width: 64rem)'

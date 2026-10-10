// Absolute base URL: ky 2 resolves `baseUrl` with `new Request()`, which rejects relative URLs outside a browser (tests).
export const API_BASE: string = import.meta.env.VITE_API_BASE ?? `${location.origin}/api/v1/`

export const MAX_ENTRY_CHARS = 5000
export const PAGE_SIZE = 10

// One map of API paths — never inline URLs in hooks. No leading slash, so each path extends API_BASE.
export const ENDPOINTS = {
  languages: 'languages',
  entries: 'entries',
  entry: (id: string) => `entries/${id}`,
  analyses: (entryId: string) => `entries/${entryId}/analyses`,
  insights: 'insights',
  check: 'check',
  rephrase: 'rephrase',
  complete: 'complete',
} as const

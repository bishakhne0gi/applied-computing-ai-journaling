// Query-key factory shared by queries and mutations. `entry(id)` prefixes `analyses(id)`, so one invalidation covers both.
export const journalKeys = {
  languages: ['languages'] as const,
  entryLists: ['entries', 'list'] as const,
  entryList: (language: string | null) => ['entries', 'list', { language }] as const,
  entry: (id: string) => ['entries', 'detail', id] as const,
  analyses: (id: string) => ['entries', 'detail', id, 'analyses'] as const,
}

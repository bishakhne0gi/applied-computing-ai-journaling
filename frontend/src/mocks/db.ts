import type { AnalysisOut } from '@/types/analysis'
import type { EntryDetailOut, EntryOut, EntryPageOut, EntrySummaryOut } from '@/types/entry'
import { countWords } from '@/utils/text'
import { seedStore, type Store } from './seed'

const PREVIEW_LENGTH = 140
let store: Store = seedStore()

export function resetMockDb(): void {
  store = seedStore()
}

const newestFirst = <T extends { created_at: string }>(a: T, b: T) => b.created_at.localeCompare(a.created_at)

export function findEntry(id: string): EntryOut | undefined {
  return store.entries.find((entry) => entry.id === id)
}

export function analysesOf(entryId: string): AnalysisOut[] {
  return store.analyses.filter((analysis) => analysis.entry_id === entryId).sort(newestFirst)
}

export function entryDetail(entry: EntryOut): EntryDetailOut {
  return { ...entry, latest_analysis: analysesOf(entry.id)[0] ?? null }
}

export interface AnalysedEntry {
  entry: EntryOut
  analysis: AnalysisOut
}

// Like the backend: each entry's newest succeeded analysis, even when a later attempt failed or never finished.
export function analysedEntries(language: string | null): AnalysedEntry[] {
  return store.entries
    .filter((entry) => language === null || entry.language === language)
    .flatMap((entry) => {
      const analysis = analysesOf(entry.id).find((item) => item.status === 'succeeded')
      return analysis ? [{ entry, analysis }] : []
    })
}

export function createEntry(language: string, text: string): EntryOut {
  const now = new Date().toISOString()
  const entry = { id: crypto.randomUUID(), language, text, word_count: countWords(text), created_at: now, updated_at: now }
  store.entries.push(entry)
  return entry
}

export function updateEntry(entry: EntryOut, text: string): EntryOut {
  Object.assign(entry, { text, word_count: countWords(text), updated_at: new Date().toISOString() })
  return entry
}

export function addAnalysis(analysis: AnalysisOut): AnalysisOut {
  store.analyses.push(analysis)
  return analysis
}

// Returns null for an unknown cursor, which the handler turns into the backend's 400.
export function listEntries(language: string | null, cursor: string | null, limit: number): EntryPageOut | null {
  const matching = store.entries.filter((entry) => !language || entry.language === language).sort(newestFirst)
  const after = cursor === null ? -1 : matching.findIndex((entry) => entry.id === cursor)
  if (cursor !== null && after === -1) return null
  const items = matching.slice(after + 1, after + 1 + limit)
  const last = items.at(-1)
  const hasMore = after + 1 + limit < matching.length
  return { items: items.map(summarise), next_cursor: hasMore && last ? last.id : null }
}

// Same as the backend's _summary: collapse whitespace, then cut by code points, not UTF-16 units.
function previewOf(text: string): string {
  const flat = text.split(/\s+/u).filter(Boolean).join(' ')
  const points = Array.from(flat)
  return points.length <= PREVIEW_LENGTH ? flat : `${points.slice(0, PREVIEW_LENGTH).join('').trimEnd()}…`
}

function summarise(entry: EntryOut): EntrySummaryOut {
  const latest = analysesOf(entry.id)[0]
  return {
    id: entry.id,
    language: entry.language,
    preview: previewOf(entry.text),
    word_count: entry.word_count,
    created_at: entry.created_at,
    latest_status: latest?.status ?? null,
    error_count: latest?.mistakes.filter((mistake) => mistake.kind === 'error').length ?? 0,
  }
}

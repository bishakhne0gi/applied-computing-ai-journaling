import type { AnalysisOut, AnalysisStatus } from './analysis'

// Mirrors backend/app/api/schemas/entries.py.
export interface EntryOut {
  id: string
  language: string
  text: string
  word_count: number
  created_at: string
  updated_at: string
}

export interface EntryDetailOut extends EntryOut {
  latest_analysis: AnalysisOut | null
}

export interface EntrySummaryOut {
  id: string
  language: string
  preview: string
  word_count: number
  created_at: string
  latest_status: AnalysisStatus | null
  error_count: number
}

export interface EntryPageOut {
  items: EntrySummaryOut[]
  next_cursor: string | null
}

export interface EntryCreate {
  language: string
  text: string
}

export interface EntryUpdate {
  text: string
}

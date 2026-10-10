import type { Category } from './analysis'

// Mirrors backend/app/api/schemas/insights.py.
export type InsightsStatus = 'insufficient_data' | 'totals_only' | 'trends'
export type Trend = 'improving' | 'stable' | 'worsening'

export interface RatePointOut {
  entry_id: string
  created_at: string
  word_count: number
  error_count: number
  rate: number | null
}

export interface CategoryInsightOut {
  category: Category
  occurrences: number
  recent_entries: number
  recurring: boolean
  earlier_rate: number | null
  recent_rate: number | null
  trend: Trend | null
  latest_example: { original: string; correction: string }
}

export interface InsightsOut {
  status: InsightsStatus
  entry_count: number
  total_words: number
  total_errors: number
  error_rate: number | null
  earlier_rate: number | null
  recent_rate: number | null
  trend: Trend | null
  recurring_window: number
  points: RatePointOut[]
  categories: CategoryInsightOut[]
  summary: string[]
}

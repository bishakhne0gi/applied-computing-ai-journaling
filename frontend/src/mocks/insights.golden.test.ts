import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { AnalysisOut, Category } from '@/types/analysis'
import type { EntryOut } from '@/types/entry'
import type { InsightsOut } from '@/types/insights'
import { pickAnalysed } from './db'
import { buildMistake } from './factories'
import { computeInsights } from './insights'

// fixtures/insights-golden.json is shared with backend/tests/unit/test_insights_golden.py, so the mock API and the
// Python rules cannot drift apart: both must produce the file's `expected` for the same entries.
interface GoldenCase {
  name: string
  entries: {
    id: string
    created_at: string
    analyses: {
      id: string
      created_at: string
      status: AnalysisOut['status']
      words: number
      errors: { category: Category; original: string; correction: string; count: number }[]
    }[]
  }[]
  expected: InsightsOut
}

const { cases } = JSON.parse(readFileSync(resolve(process.cwd(), '../fixtures/insights-golden.json'), 'utf8')) as { cases: GoldenCase[] }

function store({ entries }: GoldenCase) {
  const outEntries: EntryOut[] = entries.map((entry) => ({ id: entry.id, language: 'es', text: '', word_count: 0, created_at: entry.created_at, updated_at: entry.created_at }))
  const analyses: AnalysisOut[] = entries.flatMap((entry) =>
    entry.analyses.map((analysis) => ({
      id: analysis.id,
      entry_id: entry.id,
      status: analysis.status,
      input_text: Array.from({ length: analysis.words }, () => 'w').join(' '),
      corrected_text: null,
      feedback_summary: null,
      model: 'mock',
      prompt_version: 'v1',
      error_code: null,
      latency_ms: null,
      created_at: analysis.created_at,
      completed_at: analysis.created_at,
      mistakes: analysis.errors.flatMap(({ count, ...error }) => Array.from({ length: count }, () => buildMistake(error))),
    })),
  )
  return { outEntries, analyses }
}

describe('mock insights against the shared golden fixture', () => {
  it.each(cases)('$name', (golden) => {
    // Arrange
    const { outEntries, analyses } = store(golden)
    // Act
    const insights = computeInsights(pickAnalysed(outEntries, analyses, null))
    // Assert
    expect(insights).toEqual(golden.expected)
  })
})

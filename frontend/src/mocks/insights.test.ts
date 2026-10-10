import { isHTTPError } from 'ky'
import { describe, expect, it } from 'vitest'
import type { InsightsOut } from '@/types/insights'
import { client } from '@/utils/client'
import { ENDPOINTS } from '@/utils/endpoints'
import { failedAnalysis } from './analyzer'
import { addAnalysis, analysedEntries, findEntry } from './db'
import { computeInsights } from './insights'
import { SEEDED } from './seed'

const insightsFor = (language: string | null) => computeInsights(analysedEntries(language))

describe('mock insights', () => {
  it('reports trends across every language from the seeded entries', () => {
    // Arrange
    const language = null
    // Act
    const insights = insightsFor(language)
    // Assert
    expect(insights).toMatchObject({ status: 'trends', entry_count: 11, total_errors: 6, earlier_rate: 8.8, recent_rate: 7.7, trend: 'stable' })
    expect(insights.summary).toEqual([
      '6 errors across 11 entries — 7.6 per 100 words.',
      'Overall, your error rate is steady (8.8 → 7.7 per 100 words).',
      'Verb conjugation is getting worse (2.9 → 5.1 per 100 words).',
      'Article is improving (2.9 → 0.0 per 100 words).',
    ])
  })

  it('finds a recurring category within one language', () => {
    // Arrange
    const language = 'es'
    // Act
    const insights = insightsFor(language)
    // Assert
    expect(insights.summary).toEqual([
      '6 errors across 8 entries — 9.8 per 100 words.',
      'Overall, your error rate is getting worse (3.8 → 14.3 per 100 words).',
      'Verb conjugation is getting worse (0.0 → 8.6 per 100 words).',
      'Gender agreement is improving (3.8 → 2.9 per 100 words).',
      'Article is getting worse (0.0 → 2.9 per 100 words).',
      'Verb conjugation keeps recurring: 3 of your last 5 entries.',
    ])
    expect(insights.categories[0]).toMatchObject({ category: 'verb_conjugation', recurring: true, latest_example: { original: 'yo es', correction: 'yo soy' } })
  })

  it('gives totals only for three entries, counting the revised entry’s latest feedback', () => {
    // Arrange
    const language = 'fr'
    // Act
    const insights = insightsFor(language)
    // Assert
    expect(insights).toMatchObject({ status: 'totals_only', entry_count: 3, total_errors: 0, categories: [], trend: null })
    expect(insights.points).toHaveLength(3)
    expect(insights.summary).toEqual(['0 errors across 3 entries — 0.0 per 100 words.', 'Trends start at 4 entries with feedback.'])
  })

  it('says how many entries are still needed below three', () => {
    // Arrange
    const language = 'de'
    // Act
    const insights = insightsFor(language)
    // Assert
    expect(insights).toMatchObject({ status: 'insufficient_data', entry_count: 0, points: [], categories: [] })
    expect(insights.summary).toEqual(['Insights start after 3 entries with feedback — 3 to go.'])
  })

  it('keeps an entry’s last good feedback when a newer analysis failed', () => {
    // Arrange
    addAnalysis(failedAnalysis(SEEDED.emoji, findEntry(SEEDED.emoji)?.text ?? '', '2026-10-10T00:00:00.000Z'))
    // Act
    const insights = insightsFor('es')
    // Assert
    expect(insights).toMatchObject({ entry_count: 8, total_errors: 6 })
  })

  it('serves insights over the API and rejects an unsupported language like the backend', async () => {
    // Arrange
    const searchParams = { language: 'xx' }
    // Act
    const french = await client.get(ENDPOINTS.insights, { searchParams: { language: 'fr' } }).json<InsightsOut>()
    const rejected = await client.get(ENDPOINTS.insights, { searchParams }).catch((error: unknown) => error)
    // Assert
    expect(french.status).toBe('totals_only')
    expect(isHTTPError(rejected) && rejected.response.status).toBe(422)
  })
})

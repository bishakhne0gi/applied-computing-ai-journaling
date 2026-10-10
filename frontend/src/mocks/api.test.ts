import { describe, expect, it } from 'vitest'
import { setMockMode } from '@/test/helpers'
import type { AnalysisOut } from '@/types/analysis'
import type { EntryDetailOut, EntryOut, EntryPageOut } from '@/types/entry'
import { client } from '@/utils/client'
import { ENDPOINTS } from '@/utils/endpoints'
import { SEEDED } from './seed'

const createEntry = (text: string, language = 'es') =>
  client.post(ENDPOINTS.entries, { json: { language, text } }).json<EntryOut>()
const analyse = (id: string) => client.post(ENDPOINTS.analyses(id)).json<AnalysisOut>()
const page = (searchParams: Record<string, string | number>) =>
  client.get(ENDPOINTS.entries, { searchParams }).json<EntryPageOut>()

describe('in-memory API', () => {
  it('normalises a new entry like the backend does', async () => {
    // Arrange
    const text = '  Hola\r\nmundo  '
    // Act
    const entry = await createEntry(text)
    // Assert
    expect(entry).toMatchObject({ text: 'Hola\nmundo', word_count: 2, language: 'es' })
  })

  it('stores an analysis as the entry’s latest one', async () => {
    // Arrange
    const entry = await createEntry('Ayer yo es feliz.')
    // Act
    const analysis = await analyse(entry.id)
    const detail = await client.get(ENDPOINTS.entry(entry.id)).json<EntryDetailOut>()
    // Assert
    expect(detail.latest_analysis?.id).toBe(analysis.id)
  })

  it('pages newest first with a cursor until the last page', async () => {
    // Arrange
    const first = await page({ limit: 10 })
    // Act
    const second = await page({ limit: 10, cursor: first.next_cursor ?? '' })
    // Assert
    expect(first.items).toHaveLength(10)
    expect(first.items[0]?.id).toBe(SEEDED.revisedFrench)
    expect(second.items).toHaveLength(4)
    expect(second.next_cursor).toBeNull()
  })

  it('filters the list by language', async () => {
    // Arrange
    const language = 'fr'
    // Act
    const french = await page({ language })
    // Assert
    expect(french.items.map((item) => item.language)).toEqual(['fr', 'fr', 'fr', 'fr'])
  })

  it('reports the latest status and error count of each entry', async () => {
    // Arrange
    const { items } = await page({ limit: 50 })
    // Act
    const byId = new Map(items.map((item) => [item.id, item]))
    // Assert
    expect(byId.get(SEEDED.failed)).toMatchObject({ latest_status: 'failed', error_count: 0 })
    expect(byId.get(SEEDED.unanalysed)).toMatchObject({ latest_status: null, error_count: 0 })
    expect(byId.get(SEEDED.emoji)).toMatchObject({ latest_status: 'succeeded', error_count: 2 })
  })

  it('keeps every seeded offset aligned with its snippet', async () => {
    // Arrange
    const { items } = await page({ limit: 50 })
    // Act
    const histories = await Promise.all(
      items.map((item) => client.get(ENDPOINTS.analyses(item.id)).json<AnalysisOut[]>()),
    )
    // Assert
    const misaligned = histories
      .flat()
      .flatMap((a) =>
        a.mistakes.filter(
          (m) => m.start !== null && Array.from(a.input_text).slice(m.start, m.end ?? undefined).join('') !== m.original,
        ),
      )
    expect(misaligned).toEqual([])
  })

  it('answers an unknown entry with a 404 problem', async () => {
    // Arrange
    const request = client.get(ENDPOINTS.entry('missing')).json()
    // Act + Assert
    await expect(request).rejects.toMatchObject({ response: { status: 404 }, data: { title: 'Not Found' } })
  })

  it('rejects blank text with a 422 problem', async () => {
    // Arrange
    const request = createEntry('   ')
    // Act + Assert
    await expect(request).rejects.toMatchObject({ response: { status: 422 } })
  })

  it('fails the first analysis in analysis-fail mode and succeeds on retry', async () => {
    // Arrange
    setMockMode('analysis-fail')
    const entry = await createEntry('Ayer yo es feliz.')
    // Act
    const first = await analyse(entry.id)
    const retry = await analyse(entry.id)
    // Assert
    expect(first).toMatchObject({ status: 'failed', error_code: 'provider_timeout' })
    expect(retry.status).toBe('succeeded')
  })

  it('returns no entries in empty mode', async () => {
    // Arrange
    setMockMode('empty')
    // Act
    const result = await page({})
    // Assert
    expect(result).toEqual({ items: [], next_cursor: null })
  })

  it('answers every route with a 500 problem in error mode', async () => {
    // Arrange
    setMockMode('error')
    // Act
    const request = client.get(ENDPOINTS.languages).json()
    // Assert
    await expect(request).rejects.toMatchObject({ response: { status: 500 } })
  })
})

import { act, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SEEDED } from '@/mocks/seed'
import { setMockMode } from '@/test/helpers'
import { renderHookWithProviders } from '@/test/renderWithProviders'
import { toErrorMessage } from '@/utils/errorMessage'
import { useAnalysesQuery } from './useAnalysesQuery'
import { useEntriesQuery } from './useEntriesQuery'
import { useEntryQuery } from './useEntryQuery'
import { useInsightsQuery } from './useInsightsQuery'
import { useLanguagesQuery } from './useLanguagesQuery'

describe('query hooks', () => {
  it('lists the supported languages', async () => {
    // Arrange
    const { result } = renderHookWithProviders(() => useLanguagesQuery())
    // Act
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // Assert
    expect(result.current.data?.map((language) => language.code)).toEqual(['es', 'fr', 'de', 'it', 'pt'])
  })

  it('loads entries a page at a time until the cursor runs out', async () => {
    // Arrange
    const { result } = renderHookWithProviders(() => useEntriesQuery(null))
    await waitFor(() => expect(result.current.data).toHaveLength(10))
    // Act
    await act(() => result.current.fetchNextPage())
    // Assert
    await waitFor(() => expect(result.current.data).toHaveLength(14))
    expect(result.current.hasNextPage).toBe(false)
  })

  it('filters entries by language', async () => {
    // Arrange
    const { result } = renderHookWithProviders(() => useEntriesQuery('fr'))
    // Act
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // Assert
    expect(result.current.data?.map((entry) => entry.language)).toEqual(['fr', 'fr', 'fr', 'fr'])
  })

  it('waits for an id before fetching an entry', () => {
    // Arrange
    const id = null
    // Act
    const { result } = renderHookWithProviders(() => useEntryQuery(id))
    // Assert
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('loads an entry with its latest analysis', async () => {
    // Arrange
    const { result } = renderHookWithProviders(() => useEntryQuery(SEEDED.revisedFrench))
    // Act
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // Assert
    expect(result.current.data?.latest_analysis?.feedback_summary).toBe('Great job, no mistakes found!')
  })

  it('lists past analyses newest first', async () => {
    // Arrange
    const { result } = renderHookWithProviders(() => useAnalysesQuery(SEEDED.revisedFrench))
    // Act
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // Assert
    expect(result.current.data?.map((analysis) => analysis.mistakes.length)).toEqual([0, 1])
  })

  it('surfaces a server failure that reads as a human message', async () => {
    // Arrange
    setMockMode('error')
    const { result } = renderHookWithProviders(() => useLanguagesQuery())
    // Act
    await waitFor(() => expect(result.current.isError).toBe(true))
    // Assert
    expect(toErrorMessage(result.current.error)).toMatch(/^Something went wrong on our side/)
  })

  it('loads insights for one language', async () => {
    // Arrange
    const { result } = renderHookWithProviders(() => useInsightsQuery('fr'))
    // Act
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // Assert
    expect(result.current.data).toMatchObject({ status: 'totals_only', entry_count: 3 })
  })
})

import { act, waitFor } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { journalKeys } from '@/hooks/queries/journalKeys'
import { useAnalysesQuery } from '@/hooks/queries/useAnalysesQuery'
import { useEntriesQuery } from '@/hooks/queries/useEntriesQuery'
import { useEntryQuery } from '@/hooks/queries/useEntryQuery'
import { SEEDED } from '@/mocks/seed'
import { apiUrl, failWith, setMockMode } from '@/test/helpers'
import { renderHookWithProviders } from '@/test/renderWithProviders'
import { server } from '@/test/server'
import { ENDPOINTS } from '@/utils/endpoints'
import type { AnalysisOut } from '@/types/analysis'
import type { EntryDetailOut } from '@/types/entry'
import { useCreateEntryMutation } from './useCreateEntryMutation'
import { useRunAnalysisMutation } from './useRunAnalysisMutation'
import { useUpdateEntryMutation } from './useUpdateEntryMutation'

describe('mutation hooks', () => {
  it('creating an entry seeds its detail so the Write screen needs no refetch', async () => {
    // Arrange
    const { result, client } = renderHookWithProviders(() => useCreateEntryMutation())
    // Act
    const entry = await act(() => result.current.mutateAsync({ language: 'es', text: 'Hola mundo' }))
    // Assert
    expect(client.getQueryData(journalKeys.entry(entry.id))).toMatchObject({ text: 'Hola mundo', latest_analysis: null })
  })

  it('creating an entry puts it at the top of the history list', async () => {
    // Arrange
    const { result } = renderHookWithProviders(() => ({ list: useEntriesQuery(null), create: useCreateEntryMutation() }))
    await waitFor(() => expect(result.current.list.data).toHaveLength(10))
    // Act
    const entry = await act(() => result.current.create.mutateAsync({ language: 'es', text: 'Hola mundo' }))
    // Assert
    await waitFor(() => expect(result.current.list.data?.[0]?.id).toBe(entry.id))
  })

  it('running an analysis makes it the entry’s latest and the newest in its history', async () => {
    // Arrange
    const id = SEEDED.unanalysed
    const { result } = renderHookWithProviders(() => ({
      entry: useEntryQuery(id),
      analyses: useAnalysesQuery(id),
      analyze: useRunAnalysisMutation(),
    }))
    await waitFor(() => expect(result.current.entry.isSuccess && result.current.analyses.isSuccess).toBe(true))
    // Act
    const analysis = await act(() => result.current.analyze.mutateAsync(id))
    // Assert
    await waitFor(() => expect(result.current.entry.data?.latest_analysis?.id).toBe(analysis.id))
    expect(result.current.analyses.data?.[0]?.id).toBe(analysis.id)
  })

  it('updating an entry keeps its cached detail in sync', async () => {
    // Arrange
    const id = SEEDED.unanalysed
    const { result } = renderHookWithProviders(() => ({ entry: useEntryQuery(id), update: useUpdateEntryMutation() }))
    await waitFor(() => expect(result.current.entry.isSuccess).toBe(true))
    // Act
    await act(() => result.current.update.mutateAsync({ id, text: 'Escribo esto antes de dormir hoy.' }))
    // Assert
    await waitFor(() =>
      expect(result.current.entry.data).toMatchObject({ text: 'Escribo esto antes de dormir hoy.', word_count: 6 }),
    )
  })

  it('running an analysis writes the cache before any refetch', async () => {
    // Arrange
    const id = SEEDED.unanalysed
    const { result, client } = renderHookWithProviders(() => useRunAnalysisMutation())
    const detail: EntryDetailOut = { id, language: 'es', text: 'Escribo', word_count: 1, created_at: '', updated_at: '', latest_analysis: null }
    client.setQueryData(journalKeys.entry(id), detail)
    client.setQueryData(journalKeys.analyses(id), [])
    // Act
    const analysis = await act(() => result.current.mutateAsync(id))
    // Assert
    expect(client.getQueryData<EntryDetailOut>(journalKeys.entry(id))?.latest_analysis?.id).toBe(analysis.id)
    expect(client.getQueryData<AnalysisOut[]>(journalKeys.analyses(id))?.map((item) => item.id)).toEqual([analysis.id])
  })

  it('an entry refetch still in flight cannot overwrite the new analysis with a stale one', async () => {
    // Arrange
    const id = SEEDED.unanalysed
    const detail: EntryDetailOut = { id, language: 'es', text: 'Escribo', word_count: 1, created_at: '', updated_at: '', latest_analysis: null }
    server.use(
      http.get(apiUrl(ENDPOINTS.entry(id)), async () => {
        await delay(200)
        return HttpResponse.json(detail)
      }),
    )
    const { result, client } = renderHookWithProviders(() => ({ entry: useEntryQuery(id), analyze: useRunAnalysisMutation() }))
    await waitFor(() => expect(result.current.entry.isSuccess).toBe(true))
    const staleRefetch = client.refetchQueries({ queryKey: journalKeys.entry(id), exact: true })
    // Act
    const analysis = await act(() => result.current.analyze.mutateAsync(id))
    await staleRefetch
    await delay(300)
    // Assert
    expect(client.getQueryData<EntryDetailOut>(journalKeys.entry(id))?.latest_analysis?.id).toBe(analysis.id)
  })

  it('updating an entry refreshes the history list', async () => {
    // Arrange
    const id = SEEDED.unanalysed
    const { result } = renderHookWithProviders(() => ({ list: useEntriesQuery(null), update: useUpdateEntryMutation() }))
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true))
    // Act
    await act(() => result.current.update.mutateAsync({ id, text: 'Texto nuevo para la lista.' }))
    // Assert
    await waitFor(() =>
      expect(result.current.list.data?.find((entry) => entry.id === id)?.preview).toBe('Texto nuevo para la lista.'),
    )
  })

  it('running an analysis refreshes the history list status', async () => {
    // Arrange
    const id = SEEDED.unanalysed
    const { result } = renderHookWithProviders(() => ({ list: useEntriesQuery(null), analyze: useRunAnalysisMutation() }))
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true))
    expect(result.current.list.data?.find((entry) => entry.id === id)?.latest_status).toBeNull()
    // Act
    await act(() => result.current.analyze.mutateAsync(id))
    // Assert
    await waitFor(() =>
      expect(result.current.list.data?.find((entry) => entry.id === id)?.latest_status).toBe('succeeded'),
    )
  })

  it('a failed analysis resolves as data', async () => {
    // Arrange
    setMockMode('analysis-fail')
    const { result } = renderHookWithProviders(() => useRunAnalysisMutation())
    // Act
    const analysis = await act(() => result.current.mutateAsync(SEEDED.unanalysed))
    // Assert
    expect(analysis.status).toBe('failed')
  })

  it('a server error rejects the analysis', async () => {
    // Arrange
    failWith('post', ENDPOINTS.analyses(SEEDED.unanalysed))
    const { result } = renderHookWithProviders(() => useRunAnalysisMutation())
    // Act
    const outcome = act(() => result.current.mutateAsync(SEEDED.unanalysed))
    // Assert
    await expect(outcome).rejects.toBeDefined()
  })

  it('a language-filtered list is cached under its own key', async () => {
    // Arrange
    const { result, client } = renderHookWithProviders(() => useEntriesQuery('fr'))
    // Act
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // Assert
    expect(client.getQueryData(journalKeys.entryList('fr'))).toBeDefined()
    expect(client.getQueryData(journalKeys.entryList(null))).toBeUndefined()
  })

  it('creating an entry refreshes a filtered list too', async () => {
    // Arrange
    const { result } = renderHookWithProviders(() => ({ list: useEntriesQuery('es'), create: useCreateEntryMutation() }))
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true))
    // Act
    const entry = await act(() => result.current.create.mutateAsync({ language: 'es', text: 'Hola mundo' }))
    // Assert
    await waitFor(() => expect(result.current.list.data?.[0]?.id).toBe(entry.id))
  })
})

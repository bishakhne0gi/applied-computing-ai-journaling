import { act, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { journalKeys } from '@/hooks/queries/journalKeys'
import { useAnalysesQuery } from '@/hooks/queries/useAnalysesQuery'
import { useEntriesQuery } from '@/hooks/queries/useEntriesQuery'
import { useEntryQuery } from '@/hooks/queries/useEntryQuery'
import { SEEDED } from '@/mocks/seed'
import { renderHookWithProviders } from '@/test/renderWithProviders'
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
})

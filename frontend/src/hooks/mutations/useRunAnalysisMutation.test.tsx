import { act, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SEEDED } from '@/mocks/seed'
import { failWith, slowDown } from '@/test/helpers'
import { renderHookWithProviders } from '@/test/renderWithProviders'
import { ENDPOINTS } from '@/utils/endpoints'
import { useRunAnalysisMutation } from './useRunAnalysisMutation'

describe('useRunAnalysisMutation callbacks', () => {
  it('report the outcome even after the caller unmounted', async () => {
    // Arrange
    slowDown('post', ENDPOINTS.analyses(':entryId'))
    const onAnalysed = vi.fn()
    const { result, unmount } = renderHookWithProviders(() => useRunAnalysisMutation({ onAnalysed }))
    // Act
    act(() => result.current.mutate(SEEDED.unanalysed))
    unmount()
    // Assert
    await waitFor(() => expect(onAnalysed).toHaveBeenCalledWith(expect.objectContaining({ entry_id: SEEDED.unanalysed, status: 'succeeded' })))
  })

  it('report a request that never produced an analysis', async () => {
    // Arrange
    failWith('post', ENDPOINTS.analyses(':entryId'))
    const onFailed = vi.fn()
    const { result } = renderHookWithProviders(() => useRunAnalysisMutation({ onFailed }))
    // Act
    act(() => result.current.mutate(SEEDED.unanalysed))
    // Assert
    await waitFor(() => expect(onFailed).toHaveBeenCalledTimes(1))
  })
})

import { waitFor } from '@testing-library/react'
import { delay, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { apiUrl } from '@/test/helpers'
import { renderHookWithProviders } from '@/test/renderWithProviders'
import { server } from '@/test/server'
import { ENDPOINTS } from '@/utils/endpoints'
import { useCheckQuery } from './useCheckQuery'

describe('useCheckQuery', () => {
  it('returns hints with offsets for the text it is given', async () => {
    // Arrange + Act
    const { result } = renderHookWithProviders(() => useCheckQuery({ language: 'es', text: 'Hoy yo es feliz.' }))
    // Assert
    await waitFor(() => expect(result.current.data?.hints).toEqual([expect.objectContaining({ original: 'yo es', start: 4, end: 9 })]))
  })

  it('sends nothing without a request', async () => {
    // Arrange
    let requests = 0
    server.use(
      http.post(apiUrl(ENDPOINTS.check), () => {
        requests += 1
      }),
    )
    // Act
    const { result } = renderHookWithProviders(() => useCheckQuery(null))
    await delay(50)
    // Assert
    expect(requests).toBe(0)
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('aborts a superseded check so only the newest text answers', async () => {
    // Arrange
    const received: string[] = []
    const aborted: string[] = []
    server.use(
      http.post(apiUrl(ENDPOINTS.check), async ({ request }) => {
        const { text } = (await request.clone().json()) as { text: string }
        received.push(text)
        request.signal.addEventListener('abort', () => aborted.push(text))
        await delay(100)
      }),
    )
    let text = 'Hoy yo es feliz.'
    const { result, rerender } = renderHookWithProviders(() => useCheckQuery({ language: 'es', text }))
    await waitFor(() => expect(received).toEqual(['Hoy yo es feliz.']))
    // Act
    text = 'Hoy yo soy feliz.'
    rerender()
    // Assert
    await waitFor(() => expect(result.current.data?.analyzed_text).toBe('Hoy yo soy feliz.'))
    expect(aborted).toEqual(['Hoy yo es feliz.'])
  })
})

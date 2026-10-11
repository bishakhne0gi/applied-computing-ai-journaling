import { waitFor } from '@testing-library/react'
import { delay, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { apiUrl } from '@/test/helpers'
import { renderHookWithProviders } from '@/test/renderWithProviders'
import { server } from '@/test/server'
import { ENDPOINTS } from '@/utils/endpoints'
import { useCompletionQuery } from './useCompletionQuery'
import { useRephraseQuery } from './useRephraseQuery'

const REPHRASE = { language: 'es', text: 'Ayer fui al mercado. Hoy yo es feliz con mi familia.', start: 21, end: 52 }

function countRequests(path: string, respond: () => Response | undefined = () => undefined) {
  const counter = { requests: 0 }
  server.use(
    http.post(apiUrl(path), () => {
      counter.requests += 1
      return respond()
    }),
  )
  return counter
}

describe('useRephraseQuery', () => {
  it('posts the request and returns the answer', async () => {
    // Arrange + Act
    const { result } = renderHookWithProviders(() => useRephraseQuery(REPHRASE))
    // Assert
    await waitFor(() => expect(result.current.data?.sentence).toBe('Hoy yo es feliz con mi familia.'))
    expect(result.current.data?.versions).toHaveLength(3)
  })

  it('sends nothing without a request', async () => {
    // Arrange
    const counter = countRequests(ENDPOINTS.rephrase)
    // Act
    const { result } = renderHookWithProviders(() => useRephraseQuery(null))
    await delay(50)
    // Assert
    expect(counter.requests).toBe(0)
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('surfaces a 503 as an error and does not retry it', async () => {
    // Arrange
    const counter = countRequests(ENDPOINTS.rephrase, () => Response.json({ title: 'Service Unavailable' }, { status: 503 }))
    // Act
    const { result } = renderHookWithProviders(() => useRephraseQuery(REPHRASE))
    await waitFor(() => expect(result.current.isError).toBe(true))
    await delay(100)
    // Assert
    expect(counter.requests).toBe(1)
  })
})

describe('useCompletionQuery', () => {
  it('returns the completion for the text', async () => {
    const { result } = renderHookWithProviders(() => useCompletionQuery({ language: 'es', text: 'Hoy fui al mercado con mi madre' }))
    await waitFor(() => expect(result.current.data?.completion).toBe(' y fue un buen día.'))
  })

  it('does not retry a 503', async () => {
    const counter = countRequests(ENDPOINTS.complete, () => Response.json({ title: 'Service Unavailable' }, { status: 503 }))
    const { result } = renderHookWithProviders(() => useCompletionQuery({ language: 'es', text: 'Hoy fui al mercado con mi madre' }))
    await waitFor(() => expect(result.current.isError).toBe(true))
    await delay(100)
    expect(counter.requests).toBe(1)
  })

  it('aborts a superseded completion and never shows the old text as the new answer', async () => {
    // Arrange
    const received: string[] = []
    const aborted: string[] = []
    server.use(
      http.post(apiUrl(ENDPOINTS.complete), async ({ request }) => {
        const { text } = (await request.clone().json()) as { text: string }
        received.push(text)
        request.signal.addEventListener('abort', () => aborted.push(text))
        await delay(100)
      }),
    )
    let text = 'Hoy fui al mercado con mi madre'
    const { result, rerender } = renderHookWithProviders(() => useCompletionQuery({ language: 'es', text }))
    await waitFor(() => expect(received).toEqual(['Hoy fui al mercado con mi madre']))
    // Act
    text = 'Hoy fui al mercado '
    rerender()
    // Assert
    await waitFor(() => expect(result.current.data?.completion).toBe('y fue un buen día.'))
    expect(aborted).toEqual(['Hoy fui al mercado con mi madre'])
  })
})

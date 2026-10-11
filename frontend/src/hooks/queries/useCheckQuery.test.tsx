import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { apiUrl } from '@/test/helpers'
import { renderHookWithProviders } from '@/test/renderWithProviders'
import { server } from '@/test/server'
import { ENDPOINTS } from '@/utils/endpoints'
import { useCheckQuery } from './useCheckQuery'

const REQUEST = { language: 'es', text: 'Hoy yo es feliz.' }

// The shared test client already turns retries off; this one keeps the library defaults so the hook's own policy shows.
function renderWithDefaults() {
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return () => renderHook(() => useCheckQuery(REQUEST), { wrapper })
}

function countChecks(respond: () => Response | undefined = () => undefined) {
  const counter = { requests: 0 }
  server.use(
    http.post(apiUrl(ENDPOINTS.check), () => {
      counter.requests += 1
      return respond()
    }),
  )
  return counter
}

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

  it('shows no previous hints once the request goes away (switch off, too few words)', async () => {
    // Arrange
    let request: typeof REQUEST | null = REQUEST
    const { result, rerender } = renderHookWithProviders(() => useCheckQuery(request))
    await waitFor(() => expect(result.current.data).toBeDefined())
    // Act
    request = null
    rerender()
    // Assert
    expect(result.current.data).toBeUndefined()
  })

  it('retries an unavailable check once, after the debounce interval, then leaves hints hidden', async () => {
    // Arrange
    const counter = countChecks(() => HttpResponse.json({ detail: 'unavailable' }, { status: 503 }))
    // Act
    const { result } = renderWithDefaults()()
    await waitFor(() => expect(counter.requests).toBe(1))
    await delay(300)
    // Assert: the retry waits instead of firing at once.
    expect(counter.requests).toBe(1)
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3000 })
    expect(counter.requests).toBe(2)
  })

  it('recovers when the single retry succeeds', async () => {
    // Arrange
    let calls = 0
    countChecks(() => (++calls === 1 ? HttpResponse.json({ detail: 'unavailable' }, { status: 503 }) : undefined))
    // Act
    const { result } = renderWithDefaults()()
    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 3000 })
  })

  it('does not retry any other failure', async () => {
    // Arrange
    const counter = countChecks(() => HttpResponse.json({ detail: 'bad' }, { status: 422 }))
    // Act
    const { result } = renderWithDefaults()()
    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true))
    await delay(50)
    expect(counter.requests).toBe(1)
  })

  it('reuses the answer for text it has already checked instead of asking again', async () => {
    // Arrange
    const counter = countChecks()
    const render = renderWithDefaults()
    const first = render()
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true))
    first.unmount()
    // Act
    const second = render()
    await delay(50)
    // Assert
    expect(second.result.current.isSuccess).toBe(true)
    expect(counter.requests).toBe(1)
  })
})

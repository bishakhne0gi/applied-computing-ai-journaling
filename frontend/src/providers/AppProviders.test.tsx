import { render, screen } from '@testing-library/react'
import { http } from 'msw'
import { describe, expect, it } from 'vitest'
import { useEntryQuery } from '@/hooks/queries/useEntryQuery'
import { apiUrl } from '@/test/helpers'
import { server } from '@/test/server'
import { AppProviders } from './AppProviders'

function Probe() {
  const entry = useEntryQuery('00000000-0000-4000-8000-000000000000')
  return <p>{entry.isError ? 'failed' : 'loading'}</p>
}

describe('AppProviders', () => {
  it('does not retry a request the server rejected as a client error', async () => {
    // Arrange
    let requests = 0
    server.use(
      http.get(apiUrl('entries/:id'), () => {
        requests += 1
      }),
    )
    // Act
    render(
      <AppProviders>
        <Probe />
      </AppProviders>,
    )
    await screen.findByText('failed', {}, { timeout: 3000 })
    // react-query's first retry waits one second, so wait past it before counting.
    await new Promise((resolve) => setTimeout(resolve, 1300))
    // Assert
    expect(requests).toBe(1)
  })
})

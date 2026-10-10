import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, renderHook } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter } from 'react-router'

/** Fresh cache per test, no retries — so error states render immediately. */
function createTestClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

function Providers({ client, route, children }: { client: QueryClient; route: string; children: ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

export function renderWithProviders(ui: ReactElement, { route = '/' }: { route?: string } = {}) {
  const client = createTestClient()
  return { client, ...render(<Providers client={client} route={route}>{ui}</Providers>) }
}

export function renderHookWithProviders<T>(hook: () => T) {
  const client = createTestClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Providers client={client} route="/">
      {children}
    </Providers>
  )
  return { client, ...renderHook(hook, { wrapper }) }
}

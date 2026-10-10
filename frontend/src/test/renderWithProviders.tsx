import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, renderHook } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter } from 'react-router'

/** Fresh cache per test, no retries — so error states render immediately. */
function createTestClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

// A plain function, not a component: this file also exports helpers, which fast refresh only tolerates without components.
const wrap = (client: QueryClient, route: string, children: ReactNode) => (
  <QueryClientProvider client={client}>
    <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
  </QueryClientProvider>
)

export function renderWithProviders(ui: ReactElement, { route = '/' }: { route?: string } = {}) {
  const client = createTestClient()
  return { client, ...render(wrap(client, route, ui)) }
}

export function renderHookWithProviders<T>(hook: () => T) {
  const client = createTestClient()
  const wrapper = ({ children }: { children: ReactNode }) => wrap(client, '/', children)
  return { client, ...renderHook(hook, { wrapper }) }
}

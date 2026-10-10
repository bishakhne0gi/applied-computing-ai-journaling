import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, renderHook } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'

/** Fresh cache per test, no retries — so error states render immediately. */
function createTestClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

function Providers({ client, children }: { client: QueryClient; children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

export function renderWithProviders(ui: ReactElement) {
  const client = createTestClient()
  return { client, ...render(<Providers client={client}>{ui}</Providers>) }
}

export function renderHookWithProviders<T>(hook: () => T) {
  const client = createTestClient()
  const wrapper = ({ children }: { children: ReactNode }) => <Providers client={client}>{children}</Providers>
  return { client, ...renderHook(hook, { wrapper }) }
}

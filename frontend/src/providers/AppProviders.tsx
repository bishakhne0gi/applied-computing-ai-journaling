import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { isHTTPError } from 'ky'
import type { ReactNode } from 'react'

// A 4xx will answer the same way twice; only transport and server failures are worth another attempt.
const retryOnce = (count: number, error: Error) => !(isHTTPError(error) && error.response.status < 500) && count < 1

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: retryOnce, staleTime: 30_000 } } })

export function AppProviders({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { isHTTPError } from 'ky'
import { LazyMotion, MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'
import { ToastProvider } from '@/components/ui/Toast'

// A 4xx will answer the same way twice; only transport and server failures are worth another attempt.
const retryOnce = (count: number, error: Error) => !(isHTTPError(error) && error.response.status < 500) && count < 1

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: retryOnce, staleTime: 30_000 } } })

const loadMotionFeatures = () => import('./motionFeatures').then((module) => module.default)

// `strict` makes a stray full `motion.*` import (which would bundle every feature) throw in development.
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <LazyMotion features={loadMotionFeatures} strict>
        <MotionConfig reducedMotion="user">
          <ToastProvider>{children}</ToastProvider>
        </MotionConfig>
      </LazyMotion>
    </QueryClientProvider>
  )
}

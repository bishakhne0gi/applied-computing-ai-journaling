import { lazy, Suspense, useState } from 'react'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { loadRephraseResults } from './loadRephraseResults'
import type { RephraseResultsProps } from './RephraseResults'
import { RephraseError, RephraseLoading } from './RephraseStates'

export function LazyRephraseResults(props: RephraseResultsProps) {
  // React caches a rejected lazy import, so a retry needs a fresh one.
  const [Results, setResults] = useState(() => lazy(loadRephraseResults))
  return (
    <ErrorBoundary onRetry={() => setResults(() => lazy(loadRephraseResults))} fallback={(retry) => <RephraseError retrying={false} onRetry={retry} />}>
      <Suspense fallback={<RephraseLoading />}>
        <Results {...props} />
      </Suspense>
    </ErrorBoundary>
  )
}

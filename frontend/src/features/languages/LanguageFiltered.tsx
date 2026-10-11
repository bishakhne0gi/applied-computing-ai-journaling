import type { ReactNode } from 'react'
import { LoadingState } from '@/components/ui/LoadingState'
import { LanguageSelect } from './LanguageSelect'
import { useLanguageFilter } from './useLanguageFilter'

export interface LanguageFilteredProps {
  id: string
  loadingLabel: string
  // Skeleton shapes of the results, shown while the language list loads.
  placeholder?: ReactNode
  // Rendered above the filter; gets the language once it is safe to query (undefined while the list loads).
  header?: (language: string | null | undefined) => ReactNode
  hideLabel?: boolean
  children: (language: string | null) => ReactNode
}

// When the language list fails, LanguageSelect owns the only error and retry: results that fail beside it
// would put a second "Try again" on the same screen.
export function LanguageFiltered({ id, loadingLabel, placeholder, header, hideLabel, children }: LanguageFilteredProps) {
  const filter = useLanguageFilter()
  const ready = filter.state === 'ready'
  return (
    <div className="flex flex-col gap-3">
      {header?.(ready ? filter.language : undefined)}
      <div className={hideLabel ? undefined : 'max-w-xs'}>
        <LanguageSelect id={id} label="Filter by language" hideLabel={hideLabel} value={filter.language ?? ''} onChange={filter.changeLanguage} allLabel="All languages" />
      </div>
      {ready && children(filter.language)}
      {filter.state === 'pending' && <LoadingState label={loadingLabel}>{placeholder}</LoadingState>}
    </div>
  )
}

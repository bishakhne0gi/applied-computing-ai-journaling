import type { ReactNode } from 'react'
import { LoadingState } from '@/components/ui/LoadingState'
import { LanguageSelect } from './LanguageSelect'
import { useLanguageFilter } from './useLanguageFilter'

export interface LanguageFilteredProps {
  id: string
  loadingLabel: string
  children: (language: string | null) => ReactNode
}

// When the language list fails, LanguageSelect owns the only error and retry: results that fail beside it
// would put a second "Try again" on the same screen.
export function LanguageFiltered({ id, loadingLabel, children }: LanguageFilteredProps) {
  const filter = useLanguageFilter()
  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-xs">
        <LanguageSelect id={id} label="Filter by language" value={filter.language ?? ''} onChange={filter.changeLanguage} allLabel="All languages" />
      </div>
      {filter.state === 'ready' && children(filter.language)}
      {filter.state === 'pending' && <LoadingState label={loadingLabel} />}
    </div>
  )
}

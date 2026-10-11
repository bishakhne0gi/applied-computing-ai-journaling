import { useId } from 'react'
import { LanguageFiltered } from '@/features/languages/LanguageFiltered'
import { InsightsResults } from './InsightsResults'
import { InsightsShapes } from './InsightsSkeleton'

export function InsightsScreen() {
  const id = useId()
  return (
    <LanguageFiltered id={id} loadingLabel="Loading insights…" placeholder={<InsightsShapes />}>
      {(language) => <InsightsResults language={language} />}
    </LanguageFiltered>
  )
}

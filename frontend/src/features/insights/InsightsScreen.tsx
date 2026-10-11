import { useId } from 'react'
import { LanguageFiltered } from '@/features/languages/LanguageFiltered'
import { InsightsResults } from './InsightsResults'

export function InsightsScreen() {
  const id = useId()
  return (
    <LanguageFiltered id={id} loadingLabel="Loading insights…">
      {(language) => <InsightsResults language={language} />}
    </LanguageFiltered>
  )
}

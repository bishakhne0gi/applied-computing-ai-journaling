import { LanguageFiltered } from '@/features/languages/LanguageFiltered'
import { InsightsResults } from './InsightsResults'

export function InsightsScreen() {
  return (
    <LanguageFiltered id="insights-language" loadingLabel="Loading insights…">
      {(language) => <InsightsResults language={language} />}
    </LanguageFiltered>
  )
}

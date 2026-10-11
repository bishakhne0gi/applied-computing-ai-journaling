import type { VersionOut, VocabularyOut, RephraseOut } from '@/types/assist'
import { BetterWords } from './BetterWords'
import { VersionRow } from './VersionRow'

export interface RephraseResultsProps {
  data: RephraseOut
  tab: string
  sentence: string
  mode: 'edit' | 'read'
  onUseVersion?: (version: VersionOut) => void
  onUseWord?: (item: VocabularyOut, word: string) => void
  onCopy?: (text: string) => void
}

// The part of the card that needs the diff and compare code; loaded on its own so the editor's first paint does not carry it.
export function RephraseResults({ data, tab, sentence, mode, onUseVersion, onUseWord, onCopy }: RephraseResultsProps) {
  if (tab === 'words') return <BetterWords items={data.vocabulary} mode={mode} onUseWord={onUseWord} />
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
      {data.versions.map((version) => (
        <VersionRow key={version.tone} sentence={sentence} version={version} mode={mode} onUse={onUseVersion} onCopy={onCopy} />
      ))}
    </ul>
  )
}

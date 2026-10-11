import { useId, useState } from 'react'
import { AnimatedTabs, panelId, tabId } from '@/components/ui/AnimatedTabs'
import { Icon } from '@/components/ui/Icon'
import { InlineAlert } from '@/components/ui/InlineAlert'
import { useRephraseQuery } from '@/hooks/queries/useRephraseQuery'
import type { RephraseRequest, VersionOut, VocabularyOut } from '@/types/assist'
import { BetterWords } from './BetterWords'
import { RephraseError, RephraseLoading } from './RephraseStates'
import { VersionRow } from './VersionRow'

const TABS = [
  { id: 'versions', label: 'Rephrase' },
  { id: 'words', label: 'Better words' },
] as const

export interface RephraseCardProps {
  request: RephraseRequest
  headingId: string // the caller's dialog / sheet / section is labelled by it
  // edit: versions and alternatives are buttons that replace text; read: text with Copy, nothing replaces.
  mode: 'edit' | 'read'
  onUseVersion?: (version: VersionOut) => void
  onUseWord?: (item: VocabularyOut, word: string) => void
  onCopy?: (text: string) => void
  notice?: string | null // e.g. the stale-target message, shown as an InlineAlert above the tabs
}

type Query = ReturnType<typeof useRephraseQuery>

interface BodyProps extends Pick<RephraseCardProps, 'mode' | 'onUseVersion' | 'onUseWord' | 'onCopy'> {
  query: Query
  tab: string
  sentence: string
}

function RephraseBody({ query, tab, sentence, mode, onUseVersion, onUseWord, onCopy }: BodyProps) {
  if (query.isError) return <RephraseError onRetry={() => void query.refetch()} />
  if (!query.data) return <RephraseLoading />
  if (tab === 'words') return <BetterWords items={query.data.vocabulary} mode={mode} onUseWord={onUseWord} />
  return (
    <ul className="flex flex-col gap-3">
      {query.data.versions.map((version) => (
        <VersionRow key={version.tone} sentence={sentence} version={version} mode={mode} onUse={onUseVersion} onCopy={onCopy} />
      ))}
    </ul>
  )
}

// No outer chrome (border, shadow, close button): the composer popover, the sheet and the saved-entry section own that.
export function RephraseCard({ request, headingId, notice, ...actions }: RephraseCardProps) {
  const [tab, setTab] = useState<string>('versions')
  const prefix = useId()
  const query = useRephraseQuery(request)
  const sentence = Array.from(request.text).slice(request.start, request.end).join('')
  return (
    <div className="flex flex-col gap-3">
      <h2 id={headingId} className="flex items-center gap-2 text-base font-medium">
        <Icon name="sparkle" className="text-primary" />
        Rephrase
      </h2>
      <blockquote className="rounded-md bg-primary-soft px-3 py-2 text-fg">{sentence}</blockquote>
      {notice && <InlineAlert>{notice}</InlineAlert>}
      <div>
        <AnimatedTabs label="Suggestions" idPrefix={prefix} tabs={TABS} value={tab} onChange={setTab} />
      </div>
      <div role="tabpanel" id={panelId(prefix, tab)} aria-labelledby={tabId(prefix, tab)} tabIndex={0}>
        <RephraseBody query={query} tab={tab} sentence={sentence} {...actions} />
      </div>
    </div>
  )
}

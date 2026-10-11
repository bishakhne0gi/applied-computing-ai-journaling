import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Sheet } from '@/components/ui/Sheet'
import { useChangedSinceMount } from '@/hooks/misc/useChangedSinceMount'
import { useMediaQuery } from '@/hooks/misc/useMediaQuery'
import { useWorkspaceParams } from '@/hooks/misc/useWorkspaceParams'
import { DESKTOP_QUERY } from '@/utils/constants'
import { InsightsSheet } from './InsightsSheet'
import { MainColumn } from './MainColumn'
import { Sidebar } from './Sidebar'
import { useEntriesSheet } from './useEntriesSheet'
import { WorkspaceHeader } from './WorkspaceHeader'

export function Workspace() {
  const { entryId, insightsOpen, selectEntry, openInsights } = useWorkspaceParams()
  // Stays mounted after the first open so closing can animate out and focus can return to the header button.
  const [insightsSeen, setInsightsSeen] = useState(insightsOpen)
  if (insightsOpen && !insightsSeen) setInsightsSeen(true)
  // Desktop in jsdom (no matchMedia): most component tests exercise the two-column layout.
  const desktop = useMediaQuery(DESKTOP_QUERY, true)
  // Bumped by "New entry" so a finished session starts over even when no entry was selected.
  const [composerKey, setComposerKey] = useState(0)
  // False on first load, so a deep link never steals focus; true once the learner moves within the workspace.
  const place = `${entryId ?? ''}|${composerKey}`
  const moved = useChangedSinceMount(place)
  const entriesSheet = useEntriesSheet(`${place}|${insightsOpen}|${desktop}`)
  const startNewEntry = () => {
    selectEntry(null)
    setComposerKey((key) => key + 1)
  }
  const sidebar = <Sidebar onNewEntry={startNewEntry} onOpenInsights={openInsights} />
  return (
    <div className="flex min-h-screen flex-col">
      <WorkspaceHeader insights={{ open: insightsOpen, onOpen: openInsights }}>
        {!desktop && (
          <Button variant="ghost" className="-ml-2 px-3" aria-haspopup="dialog" aria-expanded={entriesSheet.open} onClick={entriesSheet.show}>
            <Icon name="menu" />
            Entries
          </Button>
        )}
      </WorkspaceHeader>
      <div className="flex flex-1 flex-col lg:flex-row">
        {desktop && (
          // Sticky with its own scroll, so reaching Progress never scrolls the open entry away; the padding keeps
          // focus rings and the selected row's tint inside the scroll area's clip.
          <aside
            aria-label="Your entries"
            className="sticky top-header h-below-header w-sidebar shrink-0 self-start overflow-y-auto overscroll-contain border-r border-border bg-surface px-6 py-8"
          >
            {sidebar}
          </aside>
        )}
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 px-4 py-8 lg:px-10">
          <div className="flex max-w-main flex-col gap-6">
            <MainColumn entryId={entryId} composerKey={composerKey} moved={moved} />
          </div>
        </main>
      </div>
      {!desktop && (
        <Sheet open={entriesSheet.open} onClose={entriesSheet.hide} side="left" title="Entries">
          {sidebar}
        </Sheet>
      )}
      {insightsSeen && <InsightsSheet />}
    </div>
  )
}

import { useState } from 'react'
import { useChangedSinceMount } from '@/hooks/misc/useChangedSinceMount'
import { useWorkspaceParams } from '@/hooks/misc/useWorkspaceParams'
import { InsightsSheet } from './InsightsSheet'
import { MainColumn } from './MainColumn'
import { Sidebar } from './Sidebar'
import { WorkspaceHeader } from './WorkspaceHeader'

export function Workspace() {
  const { entryId, insightsOpen, selectEntry, openInsights } = useWorkspaceParams()
  // Stays mounted after the first open so closing can animate out and focus can return to the header button.
  const [insightsSeen, setInsightsSeen] = useState(insightsOpen)
  if (insightsOpen && !insightsSeen) setInsightsSeen(true)
  // Bumped by "New entry" so a finished session starts over even when no entry was selected.
  const [composerKey, setComposerKey] = useState(0)
  // False on first load, so a deep link never steals focus; true once the learner moves within the workspace.
  const moved = useChangedSinceMount(`${entryId ?? ''}|${composerKey}`)
  const startNewEntry = () => {
    selectEntry(null)
    setComposerKey((key) => key + 1)
  }
  return (
    <div className="flex min-h-screen flex-col">
      <WorkspaceHeader insights={{ open: insightsOpen, onOpen: openInsights }} />
      <div className="mx-auto flex w-full max-w-content flex-1 flex-col px-4 lg:flex-row lg:gap-8 lg:px-6">
        {/* Below lg the composer comes first: the list loading in above it would push it down (layout shift). Task 8 moves the list into a sheet. */}
        <aside
          aria-label="Your entries"
          className="order-last border-t border-border py-8 lg:order-none lg:w-sidebar lg:shrink-0 lg:border-t-0 lg:border-r lg:pr-6"
        >
          <Sidebar onNewEntry={startNewEntry} />
        </aside>
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 py-8">
          <div className="flex max-w-main flex-col gap-6">
            <MainColumn entryId={entryId} composerKey={composerKey} moved={moved} />
          </div>
        </main>
      </div>
      {insightsSeen && <InsightsSheet />}
    </div>
  )
}

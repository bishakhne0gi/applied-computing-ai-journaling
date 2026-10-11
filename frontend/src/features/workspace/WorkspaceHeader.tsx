import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { useWorkspaceParams } from '@/hooks/misc/useWorkspaceParams'
import { LanguageStatus } from './LanguageStatus'

export interface WorkspaceHeaderProps {
  // Absent off the workspace (the not-found page): the brand stays, the sheet trigger has nothing to open over.
  insights?: { open: boolean; onOpen: () => void }
  // Rendered before the brand: the phone-only "Entries" button.
  children?: ReactNode
}

// The gradient band lives here only (DESIGN.md): it marks the frame, never the writing.
export function WorkspaceHeader({ insights, children }: WorkspaceHeaderProps) {
  const { composerHref } = useWorkspaceParams()
  return (
    <header className="sticky top-0 z-sticky h-header border-b border-border bg-linear-to-r from-band via-band-violet to-band-pink">
      <div className="flex h-full items-center gap-3 px-4 lg:px-6">
        {children}
        <Link to={composerHref} className="shrink-0 text-base font-light tracking-tight whitespace-nowrap text-fg sm:text-lg">
          Language Journal
        </Link>
        <LanguageStatus />
        {insights && (
          <Button className="ml-auto max-sm:size-11 max-sm:px-0" aria-haspopup="dialog" aria-expanded={insights.open} onClick={insights.onOpen}>
            <Icon name="chart" className="size-4" />
            {/* Icon-only (a round 44px target) on phones: with the Entries button the row would overflow 375px. */}
            <span className="sr-only sm:not-sr-only">Insights</span>
          </Button>
        )}
      </div>
    </header>
  )
}

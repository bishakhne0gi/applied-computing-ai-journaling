import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { LanguageStatus } from './LanguageStatus'

export interface WorkspaceHeaderProps {
  // Absent off the workspace (the not-found page): the brand stays, the sheet trigger has nothing to open over.
  insights?: { open: boolean; onOpen: () => void }
  // Rendered before the brand: the phone-only "Entries" button.
  children?: ReactNode
}

// The gradient band lives here only (DESIGN.md): it marks the frame, never the writing.
export function WorkspaceHeader({ insights, children }: WorkspaceHeaderProps) {
  return (
    <header className="border-b border-border bg-linear-to-r from-band via-band-violet to-band-pink">
      <div className="flex min-h-15 items-center gap-3 px-4 py-2 lg:px-6">
        {children}
        <Link to="/" className="shrink-0 whitespace-nowrap text-base font-light tracking-tight text-fg sm:text-lg">
          Language Journal
        </Link>
        <LanguageStatus />
        {insights && (
          <Button className="ml-auto" aria-haspopup="dialog" aria-expanded={insights.open} onClick={insights.onOpen}>
            <Icon name="chart" className="size-4" />
            {/* Icon-only on phones: with the Entries button and the language badge the row would overflow 375px. */}
            <span className="sr-only sm:not-sr-only">Insights</span>
          </Button>
        )}
      </div>
    </header>
  )
}

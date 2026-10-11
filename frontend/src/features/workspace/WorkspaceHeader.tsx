import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { LanguageStatus } from './LanguageStatus'

export interface WorkspaceHeaderProps {
  // Absent off the workspace (the not-found page): the brand stays, the sheet trigger has nothing to open over.
  insights?: { open: boolean; onOpen: () => void }
}

// The gradient band lives here only (DESIGN.md): it marks the frame, never the writing.
export function WorkspaceHeader({ insights }: WorkspaceHeaderProps) {
  return (
    <header className="border-b border-border bg-linear-to-r from-band via-band-violet to-band-pink">
      <div className="flex min-h-15 items-center gap-3 px-4 py-2 lg:px-6">
        <Link to="/" className="text-lg font-light tracking-tight text-fg">
          Language Journal
        </Link>
        <LanguageStatus />
        {insights && (
          <Button className="ml-auto" aria-haspopup="dialog" aria-expanded={insights.open} onClick={insights.onOpen}>
            <Icon name="chart" className="size-4" />
            Insights
          </Button>
        )}
      </div>
    </header>
  )
}

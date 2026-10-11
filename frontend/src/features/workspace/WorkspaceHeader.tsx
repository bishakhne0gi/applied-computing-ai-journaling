import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'

export interface WorkspaceHeaderProps {
  insightsOpen: boolean
  onOpenInsights: () => void
}

// The gradient band lives here only (DESIGN.md): it marks the frame, never the writing.
export function WorkspaceHeader({ insightsOpen, onOpenInsights }: WorkspaceHeaderProps) {
  return (
    <header className="border-b border-border bg-linear-to-b from-band to-bg">
      <div className="mx-auto flex max-w-content items-center gap-3 px-4 py-2 lg:px-6">
        <Link to="/" className="text-lg font-light tracking-tight text-fg">
          Language Journal
        </Link>
        <Button className="ml-auto" aria-haspopup="dialog" aria-expanded={insightsOpen} onClick={onOpenInsights}>
          <Icon name="chart" className="size-4" />
          Insights
        </Button>
      </div>
    </header>
  )
}

import { Link } from 'react-router'
import { Icon } from '@/components/ui/Icon'
import { TextLink } from '@/components/ui/TextLink'

// The gradient band lives here only (DESIGN.md): it marks the frame, never the writing.
export function WorkspaceHeader() {
  return (
    <header className="border-b border-border bg-linear-to-b from-band to-bg">
      <div className="mx-auto flex max-w-content items-center gap-3 px-4 py-2 lg:px-6">
        <Link to="/" className="text-lg font-light tracking-tight text-fg">
          Language Journal
        </Link>
        <TextLink to="/insights" className="ml-auto inline-flex min-h-11 items-center gap-2 text-sm no-underline hover:underline">
          <Icon name="chart" className="size-4" />
          Insights
        </TextLink>
      </div>
    </header>
  )
}

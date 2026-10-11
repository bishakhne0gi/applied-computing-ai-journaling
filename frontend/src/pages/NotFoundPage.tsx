import { PageHeading } from '@/components/ui/PageHeading'
import { TextLink } from '@/components/ui/TextLink'
import { WorkspaceHeader } from '@/features/workspace/WorkspaceHeader'

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <WorkspaceHeader />
      <main id="main" tabIndex={-1} className="flex flex-col items-start gap-4 px-4 py-12 lg:px-10">
        <title>Page not found · Language Journal</title>
        <PageHeading>Page not found</PageHeading>
        <p className="text-muted">That page does not exist.</p>
        <TextLink to="/">Back to writing</TextLink>
      </main>
    </div>
  )
}

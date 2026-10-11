import { PageHeading } from '@/components/ui/PageHeading'
import { TextLink } from '@/components/ui/TextLink'

export function NotFoundPage() {
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex max-w-main flex-col items-start gap-4 px-4 py-12">
      <title>Page not found · Language Journal</title>
      <PageHeading>Page not found</PageHeading>
      <p className="text-muted">That page does not exist.</p>
      <TextLink to="/">Back to writing</TextLink>
    </main>
  )
}

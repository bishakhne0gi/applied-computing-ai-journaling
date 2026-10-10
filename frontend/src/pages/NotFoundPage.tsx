import { PageHeading } from '@/components/ui/PageHeading'
import { TextLink } from '@/components/ui/TextLink'

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-start gap-4">
      <title>Page not found · Language Journal</title>
      <PageHeading>Page not found</PageHeading>
      <p className="text-muted">That page does not exist.</p>
      <TextLink to="/">Back to writing</TextLink>
    </div>
  )
}

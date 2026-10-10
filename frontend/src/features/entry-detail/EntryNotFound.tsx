import { EmptyState } from '@/components/ui/EmptyState'
import { TextLink } from '@/components/ui/TextLink'

export function EntryNotFound() {
  return (
    <div role="alert">
      <EmptyState title="We couldn't find that entry. It may have been removed.">
        <TextLink to="/entries">Back to history</TextLink>
      </EmptyState>
    </div>
  )
}

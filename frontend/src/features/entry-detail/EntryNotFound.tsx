import { EmptyState } from '@/components/ui/EmptyState'
import { TextLink } from '@/components/ui/TextLink'
import { useWorkspaceParams } from '@/hooks/misc/useWorkspaceParams'

export function EntryNotFound() {
  // Keeps the language filter (and mock mode) like every other move inside the workspace.
  const { composerHref } = useWorkspaceParams()
  return (
    <EmptyState title="We couldn't find that entry. It may have been removed.">
      <TextLink to={composerHref}>Write a new entry</TextLink>
    </EmptyState>
  )
}

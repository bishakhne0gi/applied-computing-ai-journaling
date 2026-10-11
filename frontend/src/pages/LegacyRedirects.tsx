import { Navigate, useLocation, useParams } from 'react-router'

// Links and bookmarks from before the single-screen workspace keep working, with their query (a language filter) kept.
function useWorkspaceTarget(changes: Record<string, string>): string {
  const { search } = useLocation()
  const params = new URLSearchParams(search)
  for (const [key, value] of Object.entries(changes)) params.set(key, value)
  const query = params.toString()
  return query ? `/?${query}` : '/'
}

export function EntriesRedirect() {
  const target = useWorkspaceTarget({})
  return <Navigate replace to={target} />
}

export function EntryRedirect() {
  const { entryId = '' } = useParams()
  const target = useWorkspaceTarget({ entry: entryId })
  return <Navigate replace to={target} />
}

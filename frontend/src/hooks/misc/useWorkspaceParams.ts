import { useLocation, useNavigate, useSearchParams } from 'react-router'

type Changes = Partial<Record<'entry' | 'insights' | 'language', string | null>>

function withChanges(current: URLSearchParams, changes: Changes): URLSearchParams {
  const next = new URLSearchParams(current)
  for (const [key, value] of Object.entries(changes)) {
    if (value) next.set(key, value)
    else next.delete(key)
  }
  return next
}

function toHref(params: URLSearchParams): string {
  const query = params.toString()
  return query ? `/?${query}` : '/'
}

// Marks the history entry the app pushed to open insights, so closing can go Back instead of stacking a duplicate.
const OPENED_IN_APP = { insightsOpenedInApp: true } as const

function openedInApp(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'insightsOpenedInApp' in state
}

// The workspace's single state owner: which entry is open, whether insights shows, which language filters both.
// Anything else in the query (`mock`, a future sort) passes through untouched.
export function useWorkspaceParams() {
  const [params, setParams] = useSearchParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const change = (changes: Changes, options?: { replace?: boolean; state?: unknown }) => setParams(withChanges(params, changes), options)
  return {
    entryId: params.get('entry') || null,
    insightsOpen: params.get('insights') === '1',
    language: params.get('language'),
    entryHref: (id: string) => toHref(withChanges(params, { entry: id, insights: null })),
    selectEntry: (id: string | null) => change({ entry: id }),
    openInsights: () => change({ insights: '1' }, { state: OPENED_IN_APP }),
    closeInsights: () => {
      if (openedInApp(state)) void navigate(-1)
      else change({ insights: null }, { replace: true })
    },
    setLanguage: (code: string | null, options?: { replace?: boolean }) => change({ language: code }, options),
  }
}

export type WorkspaceParams = ReturnType<typeof useWorkspaceParams>

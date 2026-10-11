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
  const insightsOpen = params.get('insights') === '1'
  const entryId = params.get('entry') || null
  return {
    entryId,
    insightsOpen,
    language: params.get('language'),
    entryHref: (id: string) => toHref(withChanges(params, { entry: id, insights: null })),
    composerHref: toHref(withChanges(params, { entry: null, insights: null })),
    // The router pushes even an identical URL, so re-selecting (or "New entry" on the composer) would stack a duplicate.
    selectEntry: (id: string | null) => {
      if (id !== entryId) change({ entry: id })
    },
    // A repeat open would stack a duplicate entry, and closing (one step Back) would then leave the sheet open.
    openInsights: () => {
      if (!insightsOpen) change({ insights: '1' }, { state: OPENED_IN_APP })
    },
    closeInsights: () => {
      if (openedInApp(state)) void navigate(-1)
      else change({ insights: null }, { replace: true })
    },
    // Filtering inside the sheet replaces and drops the opened-in-app mark: closing then replaces too, so Back
    // returns to before the sheet opened instead of reopening it.
    setLanguage: (code: string | null, options?: { replace?: boolean }) =>
      change({ language: code }, insightsOpen ? { replace: true } : options),
  }
}

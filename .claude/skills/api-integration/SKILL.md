---
name: api-integration
description: Recipe for the data layer — pinned installs plus ready templates for the ky client, ENDPOINTS map, TanStack Query hooks, providers and MSW mocks. Use ONLY when the phase plan calls for the API layer; never pre-create any of it.
---
# API integration (phase plan calls for the API layer)

Templates live in `.claude/skills/api-integration/templates/` and are known to work
(copied literally, `pnpm verify` incl. Lighthouse stays green). Copy, then rename `Item`.

1. Install from `frontend/` (asks the human): `pnpm add ky@2.1.0 @tanstack/react-query@5.104.0 && pnpm add -D msw@2.15.0 && pnpm exec msw init public --save`
2. Copy templates → destinations:

| Template | Destination | Why |
|---|---|---|
| `constants.ts` | `frontend/src/utils/constants.ts` | absolute `API_BASE` (ky 2 `baseUrl` must be absolute in tests) |
| `endpoints.ts` | `frontend/src/utils/endpoints.ts` | one `ENDPOINTS` map, no inline URLs |
| `client.ts` | `frontend/src/utils/client.ts` | one ky instance: `baseUrl`, timeout |
| `item.ts` | `frontend/src/types/<entity>.ts` | entity types outside features/ so hooks never import upward |
| `itemKeys.ts` | `frontend/src/hooks/queries/<entity>Keys.ts` | query-key factory shared with mutations |
| `useGetItemsQuery.ts` | `frontend/src/hooks/queries/` | the hook is the interface |
| `useUpdateItemMutation.ts` | `frontend/src/hooks/mutations/` | only if the plan has a write action — optimistic + rollback |
| `AppProviders.tsx` | `frontend/src/providers/` | one QueryClient (retry 1, staleTime 30s) |
| `main.tsx` | `frontend/src/main.tsx` | wraps providers; starts MSW in dev and in the `mock` build |
| `handlers.ts`, `browser.ts` | `frontend/src/mocks/` | dev + Lighthouse data; `?mock=slow|error|empty` forces states |
| `server.ts`, `setup.ts`, `renderWithProviders.tsx` | `frontend/src/test/` | same handlers in tests; fresh QueryClient per test |

3. Existing tests that render `<App />` (e.g. `frontend/src/App.test.tsx`): switch `render` → `renderWithProviders`
   (`import { renderWithProviders } from '@/test/renderWithProviders'`).
4. Features render all four states from the hook (`isPending`, `isError`, empty `data`, ready).
5. Tests: `renderWithProviders(<X />)`; failures via `server.use(http.get(\`${API_BASE}${ENDPOINTS.x}\`, () => HttpResponse.error()))`.

Rules: components/features never import `client` or `ENDPOINTS` (lint-enforced). Server data lives only in the
query cache; derive with `select`. The Lighthouse gate builds with `--mode mock`, so the audited page has data.

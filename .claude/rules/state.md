---
paths:
  - "frontend/src/features/**"
  - "frontend/src/hooks/**"
  - "frontend/src/**/use*.ts"
---
# State & data rules
- Local first: `useState` / `useReducer` (pure, exported, unit-tested reducer) inside the feature.
- Shared across distant components → zustand: `pnpm -C frontend add zustand@5.0.15`, one `features/<f>/store.ts`,
  UI/client state only (filters, selection, drafts). Read with selectors, not the whole store.
- Server data → TanStack Query only (recipe: `api-integration` skill). Never copy query data into
  useState or zustand; derive with `select` / selectors / `useMemo`.
- Store raw values only; counts, filtered/sorted/paged views are derived, never stored twice.
- Actions/reducers: discriminated union `{ type: 'x/verb', payload }`, exhaustive `switch` (`never`).
- Async state is explicit (`isPending`, `isError`, `data`) — render all four UI states from it.
- Optimistic updates roll back on failure and surface the error.
- No setState directly in `useEffect` (react-hooks `set-state-in-effect`): derive, or set in handlers.
- Nothing speculative: no store, query layer or router unless the phase plan calls for it.

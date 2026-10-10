---
name: testing
description: Testing strategy — pyramid layers, AAA, MSW mocking, Playwright + axe, coverage band. Use when writing or reviewing tests, or deciding which layer a test belongs to.
---
# Testing

## Which layer?
| Layer | Tool | What | Share |
|---|---|---|---|
| Unit | Vitest | reducers, selectors, validators, formatters — pure functions | most |
| Component | Vitest + RTL (+ MSW) | each UI state, user interactions, a11y roles | some |
| E2E | Playwright + axe | one journey per AC group, desktop + mobile | few |

Rule: push each check to the lowest layer that can prove it. Bugs found in e2e get a unit/component
regression test too — cheaper to rerun and cheaper to debug.

## AAA template (default: local state)
```tsx
it('empties the selection count after "Clear selection"', async () => {
  // Arrange
  const user = userEvent.setup()
  render(<Feature initialSelected={['1', '2']} />)
  // Act
  await user.click(screen.getByRole('button', { name: /clear selection/i }))
  // Assert
  expect(screen.getByRole('status')).toHaveTextContent(/0 selected/i)
})
```
For components that fetch: render via `renderWithProviders`, force failures with
`server.use(http.get(\`${API_BASE}${ENDPOINTS.x}\`, () => HttpResponse.error()))` (see `api-integration` templates).

## Rules
- Behaviour names, one behaviour per test, role-based queries, `userEvent.setup()`.
- Mock the network with MSW, never the unit under test. Fake timers only for debounce/polling.
- E2E: `import { expectNoA11yViolations } from './a11y'` — call it after each meaningful state.
- Coverage: `pnpm coverage`. <65% fails. >85% warns — look for assert-nothing tests.
- Mutation check by hand: break the implementation line — the test must go red.

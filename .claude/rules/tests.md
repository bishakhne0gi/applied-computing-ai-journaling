---
paths:
  - "frontend/src/**/*.test.ts"
  - "frontend/src/**/*.test.tsx"
  - "frontend/e2e/**"
---
# Test rules
- AAA: `// Arrange`, `// Act`, `// Assert` sections in every test. One behaviour per test.
- Name tests by behaviour and why: `it('hides the badge when every item is read')`.
- Pyramid: reducers/selectors/validators → unit (most). Component states → RTL (+ MSW). User journeys → Playwright (fewest).
- Query by role/label/text (`getByRole`), never by class or test-id unless no accessible handle exists.
- `userEvent` over `fireEvent`. Mock the network with MSW, never the module under test.
- e2e: one spec per acceptance-criteria group; call `expectNoA11yViolations(page)` and `expectButtonsShowPointer(page)`
  after each meaningful state; runs desktop + mobile.
- Coverage band 65–85%. Above 85% → look for tests that assert nothing meaningful.
- A test must fail when the behaviour breaks — if deleting the implementation line doesn't fail it, rewrite it.

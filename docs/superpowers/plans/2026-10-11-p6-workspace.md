# P6 Single-Screen Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Write, History, Entry detail and Insights into one workspace screen on `/` — sidebar of entries, a main column that swaps between the composer and a selected entry, insights in a sheet, all state in the URL — restyled with a Stripe-inspired token set, SmoothUI-derived motion primitives and inline `[English]` chips in the editor.

**Architecture:** The search params are the only owner of workspace state (`entry`, `insights`, `language`) through one hook, `hooks/misc/useWorkspaceParams`; old routes redirect into `/`. `features/workspace` composes the existing features (history list, entry detail, write screen, insights screen) inside a layout: a desktop sidebar (`lg` and up) or a left sheet on phones, a main column, and an insights sheet (right on desktop, bottom on phones). New primitives in `components/ui` are hand-ported from SmoothUI (MIT) onto our tokens: `Sheet`, `AnimatedTabs`, `Skeleton`, `Toast`, `Tooltip`, plus `Card`, `Icon` and `HighlightedTextarea` (native textarea over an `aria-hidden` mirrored backdrop). Animation uses `motion` through `LazyMotion` with lazily loaded `domAnimation` features and `m.*` components; every animation honours `useReducedMotion`.

**Tech Stack:** React 19, TypeScript 6 (strict), Tailwind v4 tokens, React Router 8.4.0 (search params, `Navigate`, `useNavigationType`), TanStack Query 5.104.0, `motion` 14.1.0 (`motion/react`: `LazyMotion`, `MotionConfig`, `AnimatePresence`, `m`, `useReducedMotion`, `domAnimation` — verified in the 14.1.0 tarball: `m` ≈ 5 kB gz, `m` + `domAnimation` ≈ 26 kB gz, `domMax` ≈ 40 kB gz), Vitest + Testing Library + MSW, Playwright + axe, Lighthouse.

**Spec:** `docs/superpowers/specs/2026-10-11-p6-workspace-redesign.md` (§2 workspace, §3 visual language, §4 components, §5 gates, §6 out of scope, §7.1 bracket chips — §7.2 live hints is P7, `2026-10-11-p7-live-hints.md`). It amends §7 "Frontend" of `docs/superpowers/specs/2026-10-10-ai-language-journal-design.md` (the design doc calls it §5). Interfaces consumed are the real code on `main` after P5.

## Global Constraints

- **Start only after P5 is marked done** in `docs/superpowers/plans/2026-10-10-00-index.md` (it is).
- Gates, thresholds unchanged: `make verify` (needs `make db`) ends with `ALL GATES GREEN` at the end of **every** task — types → lint → fallow dupes/dead code → Vitest + coverage band 65–85% → Playwright + axe (desktop 1280 and mobile 375) → Lighthouse desktop 100/100/100/100 and mobile performance ≥ 90 on the mock build of `/`. `make e2e-stack` (Docker) runs in Tasks 11 and 12. Never lower a threshold, disable a rule or skip a test to pass.
- Hard limits (eslint, never disabled): file ≤ 200 lines (tests included), function ≤ 60 lines, complexity ≤ 10 (`?.`, `??`, `&&`, ternaries and default params count), cognitive ≤ 12, depth ≤ 3. Split, don't disable.
- Boundaries (eslint): `components/` is a pure library (no `features|hooks|pages|providers`, no `utils/client|endpoints`); features reach data only through `hooks/queries` and `hooks/mutations`; pages are thin shells without data hooks; `hooks/misc` is data-free (React Router is fine there).
- Styling: tokens only — no arbitrary values, palette classes, `dark:`, raw `z-*` or inline `style`. Every button is `<Button>`. Primitives live in `src/components/ui/<Name>/{<Name>.tsx,<Name>.test.tsx,index.ts}` and get a row in `frontend/DESIGN.md`. Raw values live only in `src/styles/tokens.css`.
- One owner per piece of state: workspace selection/sheet/filter = URL search params (`useWorkspaceParams`); server data = TanStack Query cache; draft text + last language = `localStorage` (existing `useDraft`); the phone entries-sheet open flag and the composer remount key = local state in `Workspace`. Nothing is stored twice.
- **New dependency (the only one in this phase):** `motion@14.1.0`, exact pin. Reason line for this plan and the commit body: "Animation layer the ported SmoothUI primitives are written against (sheet slide, tab indicator, toast, tooltip); used as `m` + lazily loaded `domAnimation`, ~5 kB gz up front." No `lucide-react`, Radix, CVA, vaul, zustand or any other package.
- Ported files start with the exact line `// Adapted from SmoothUI (MIT), https://smoothui.dev` (licence notice).
- Reduced motion: every `m.*` element takes `transition={{ duration: 0 }}` and skips transform offsets when `useReducedMotion()` is true; `AppProviders` wraps the app in `<MotionConfig reducedMotion="user">`; CSS animations are already zeroed by `global.css`.
- Copy: "Get feedback", "Analyzing…", "Retry analysis", "Revise & re-check", "New entry", "Load more", "Saved", "Insights", "Entries", "Open insights", "Filter by language", "Your text" / "Corrected". The composer's select keeps the label "Language"; both list filters are "Filter by language" so no two controls on one screen share a name.
- Never log entry text or send it to Sentry; no `console.*` in app code. Never open, print or reference the real env file.
- Tests: AAA comments, behaviour names, role queries (`within(...)` to scope; a class query only for the decorative backdrop/scrim, with a comment), `userEvent.setup()`, MSW for the network. Do not assert `toBeVisible()` on `m.*` elements in Vitest — without loaded features their initial `opacity: 0` stays (use `toBeInTheDocument`). Playwright calls `expectNoA11yViolations` + `expectButtonsShowPointer` after each meaningful state.
- Comments explain why, never what. Commits: plain message as the configured git user (`bishakhne0gi`), no `Co-Authored-By`, no AI attribution, files staged explicitly with `git add <paths>`; **never stage anything under `.github/`** (workflows are local-only); no `git push` inside a task (the controller pushes after the checkpoint).

## Review Focus

- A mistake panel is open in the main column and the learner opens insights, then presses Esc → only the sheet closes; the panel stays open. (Task 2 `Sheet` test "lets Escape close only the sheet"; the panel listens on `document`, the sheet stops propagation.)
- A learner on a phone picks an entry in the entries sheet → the sheet closes and focus lands on the entry heading, not back on the "Entries" button; Back afterwards does not reopen the sheet. (Task 2 focus-restore guard test; Task 8 mobile workspace tests.)
- Back/Forward through `?entry` and `?insights` → the screen follows the URL; closing insights the app opened goes Back (no duplicate entry), closing a deep-linked sheet replaces the URL instead of leaving the app. (Task 4 `useWorkspaceParams` tests; Task 6 workspace insights tests + e2e Back journey.)
- A bookmark from before P6 (`/entries/<id>?language=fr`, `/entries?language=es`, `/insights`) or a mangled `/?entry=not-an-id` → lands in the workspace with the query kept, focus untouched; a bad id shows "Entry not found" in the main column with the sidebar still usable. (Task 5 AppRoutes redirect table + workspace missing-entry test.)
- The analysis of a new entry finishes after the learner opened another entry → a toast says so; if the learner is still looking at the composer, no toast (the inline status already says it). (Task 9 workspace toast tests; Task 9 mutation test that hook-level callbacks still fire after unmount.)

## File map

```
DESIGN.md (new, repo root)                                                                     (T1)
frontend/
  package.json · pnpm-lock.yaml                     motion@14.1.0                              (T2)
  DESIGN.md                                         token + primitive rows                     (T1–T3, T10)
  src/styles/{tokens.css, global.css, tokens.contrast.test.ts (new)}                           (T1)
  src/utils/{utils.ts, constants.ts, text.ts (+tests)}                                         (T1, T4, T10)
  src/components/ui/
    Button · Badge · Select · Textarea · Field · TextLink · EmptyState · ErrorState · PageHeading (restyle)  (T1)
    Card (new)                                                                                 (T1)
    Icon (new) · Sheet (new: Sheet, SheetPanel, focus.ts)                                       (T2)
    AnimatedTabs · Skeleton · Toast (ToastContext, ToastProvider, ToastItem, useToast) · Tooltip (new); LoadingState  (T3)
    HighlightedTextarea (new: HighlightedTextarea, decorate.ts)                                (T10)
  src/providers/{AppProviders.tsx, motionFeatures.ts (new)}                                    (T2, T3)
  src/test/{renderWithProviders.tsx, helpers.ts, LocationProbe.tsx (new)}                      (T3, T5)
  src/hooks/misc/{useWorkspaceParams, useChangedSinceMount, useMediaQuery}.ts (new, +tests)    (T4)
  src/hooks/misc/useFocusOnRouteChange.ts (+test)                                              (T4)
  src/hooks/mutations/useRunAnalysisMutation.ts (+test)                                        (T9)
  src/features/languages/{useLanguageFilter.ts, LanguageFiltered.tsx}                          (T4, T5)
  src/features/workspace/ (new)
    Workspace · WorkspaceHeader · Sidebar · MainColumn · Composer                              (T5)
    InsightsSheet                                                                              (T6)
    ProgressCard · ProgressSummary · Sparkline · LanguageStatus                                (T7)
    useEntriesSheet                                                                            (T8)
    Workspace.test · Workspace.insights.test · ProgressCard.test · Workspace.mobile.test · Workspace.toast.test
  src/features/history/{HistoryList, FilteredHistory, HistoryResults, EntryRow, useFocusNewRows} (T5, T7)
  src/features/entry-detail/{EntryDetail, EntryHeader, EntryNotFound}                          (T5, T7)
  src/features/insights/{InsightsScreen, InsightsResults, RateChart, RateLines (new)}          (T6, T7)
  src/features/feedback/{FeedbackView, TextVersions (new), Legend, labels, MistakePanel}       (T1, T9)
  src/features/write/{WriteScreen, useWriteSession, useBackgroundToasts (new)}                 (T5, T9)
  src/features/editor/EntryTextField.tsx                                                       (T10)
  src/features/shell/AppShell.tsx · src/AppRoutes.tsx (+test)                                  (T5, T6)
  src/pages/{WorkspacePage, LegacyRedirects (new), NotFoundPage}; delete Write/History/EntryDetail/Insights pages  (T5, T6)
  e2e/{workspace.ts (new), smoke, history, write, insights, workspace.spec (new)}.ts           (T5–T11)
  e2e-stack/{journal, insights}.spec.ts                                                        (T11)
README.md · docs/loom-outline.md · frontend/CLAUDE.md · main spec §7 · docs/qa/p6-*.png · plans index  (T12)
```

Tasks: 1 design tokens + DESIGN.md + primitive restyle · 2 `motion` + Icon + Sheet · 3 AnimatedTabs, Skeleton, Toast, Tooltip · 4 URL-state hooks · 5 workspace flip (layout, sidebar, main column, redirects) · 6 insights sheet · 7 progress card, skeletons, header status · 8 phone layout (entries sheet) · 9 feedback polish (tabs toggle, legend tooltips, background toasts) · 10 bracket chips (`HighlightedTextarea`) · 11 e2e workspace sweep, full-stack journeys, Lighthouse · 12 docs + checkpoint.

Why e2e is spread over tasks instead of one rewrite task: `make verify` runs Playwright, so every task that changes a journey updates its spec in the same commit; Task 11 adds the cross-cutting workspace spec and rewrites the Docker-only `e2e-stack` journeys.

---

### Task 1: Design tokens, DESIGN.md and primitive restyle

Visual only. Every existing test stays green; new tests pin the contrast of every token pair and the new primitive contracts.

**Files:**
- Create: `DESIGN.md`, `frontend/src/styles/tokens.contrast.test.ts`, `frontend/src/components/ui/Card/{Card.tsx,Card.test.tsx,index.ts}`
- Modify: `frontend/src/styles/tokens.css`, `frontend/src/styles/global.css`, `frontend/src/utils/utils.ts`, `frontend/DESIGN.md`, `frontend/src/components/ui/{Button,Badge,Select,Textarea,Field,TextLink,EmptyState,ErrorState,PageHeading}/*.tsx`, `frontend/src/components/ui/{Button,PageHeading}/*.test.tsx`, `frontend/src/features/feedback/MistakePanel.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - Colour tokens (utilities `bg-*`, `text-*`, `border-*`, `from-*`, `to-*`, `decoration-*`): `bg, surface, border, border-input, fg, fg-secondary, muted, primary, primary-pressed, primary-soft, primary-contrast, danger, success, warning, scrim, band, mark-error(-bg), mark-suggestion(-bg), mark-vocab(-bg)`.
  - Shape: `rounded-sm|md|lg|full`, `shadow-sm|md|lg|chip`. Layout: `max-w-content` (80rem), `w-sidebar`/`max-w-sidebar` (20rem), `max-w-main` (44rem), `max-w-sheet` (36rem).
  - `Button` variants: `primary | secondary | ghost | icon | inline` (Task 3 adds `tab`).
  - `Card({ as?: 'div' | 'section', ...ComponentPropsWithoutRef<'section'> })`.
  - `PageHeading({ children, ref?: Ref<HTMLHeadingElement> })`.

Contrast (WCAG relative luminance, computed for these exact values; the test recomputes them from `tokens.css`):

| Pair | Light | Dark | Bar |
|---|---|---|---|
| `fg` on `bg` | 15.57 | 15.02 | 4.5 |
| `fg` on `surface` | 14.73 | 13.58 | 4.5 |
| `fg-secondary` on `bg` / `surface` | 11.73 / 11.10 | 11.09 / 10.03 | 4.5 |
| `muted` on `bg` / `surface` | 4.96 / 4.69 | 7.48 / 6.76 | 4.5 |
| `primary` on `bg` / `surface` | 6.19 / 5.86 | 6.57 / 5.94 | 4.5 |
| `primary-contrast` on `primary` / `primary-pressed` | 6.19 / 11.41 | 6.57 / 9.83 | 4.5 |
| `danger` on `bg` / `surface` | 6.19 / 5.86 | 7.33 / 6.63 | 4.5 |
| `success` on `bg` / `surface` | 5.44 / 5.15 | 9.35 / 8.45 | 4.5 |
| `warning` on `bg` / `surface` | 5.62 / 5.32 | 9.59 / 8.68 | 4.5 |
| `fg` / `fg-secondary` / `primary` on `primary-soft` | 13.31 / 10.03 / 5.30 | 12.77 / 9.43 / 5.59 | 4.5 |
| `fg` on `band` · `bg` on `fg` (tooltip) | 13.74 · 15.57 | 14.23 · 15.02 | 4.5 |
| `fg` on `mark-error-bg` / `mark-suggestion-bg` / `mark-vocab-bg` | 13.84 / 14.28 / 13.61 | 13.64 / 12.75 / 13.09 | 4.5 |
| `mark-error` / `mark-suggestion` / `mark-vocab` on its own tint | 5.50 / 5.16 / 5.78 | 6.66 / 8.14 / 7.61 | 4.5 |
| `border-input` on `bg` / `surface` (non-text, WCAG 1.4.11) | 3.29 / 3.11 | 3.84 / 3.48 | 3 |

Deviations from the design's raw values, both for contrast: muted `#64748d` → `#61718a` (the original is 4.49:1 on the soft canvas); input border `#a8c3de` → `#7a90a8` (the original is 1.82:1, below the 3:1 non-text bar, so empty inputs would be invisible to low-vision users).

- [ ] **Step 1: Write the failing contrast test**

`frontend/src/styles/tokens.contrast.test.ts`:
```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')

// Only six-digit hex colours are contrast-checked; rgb() values (scrim) are overlays, not text or borders.
function colours(marker: string): Record<string, string> {
  const start = css.indexOf(marker)
  const body = css.slice(start, css.indexOf('}', start))
  return Object.fromEntries(Array.from(body.matchAll(/--color-([\w-]+):\s*(#[0-9a-f]{6})/giu), ([, name = '', hex = '']) => [name, hex]))
}

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

function ratio(a = '', b = ''): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05)
}

const light = colours('@theme')
const dark = { ...light, ...colours('@media (prefers-color-scheme: dark)') }

const TEXT: [string, string][] = [
  ['fg', 'bg'], ['fg', 'surface'], ['fg-secondary', 'bg'], ['fg-secondary', 'surface'], ['muted', 'bg'], ['muted', 'surface'],
  ['primary', 'bg'], ['primary', 'surface'], ['primary-contrast', 'primary'], ['primary-contrast', 'primary-pressed'],
  ['danger', 'bg'], ['danger', 'surface'], ['success', 'bg'], ['success', 'surface'], ['warning', 'bg'], ['warning', 'surface'],
  ['fg', 'primary-soft'], ['fg-secondary', 'primary-soft'], ['primary', 'primary-soft'], ['fg', 'band'], ['bg', 'fg'],
  ['fg', 'mark-error-bg'], ['fg', 'mark-suggestion-bg'], ['fg', 'mark-vocab-bg'],
  ['mark-error', 'mark-error-bg'], ['mark-suggestion', 'mark-suggestion-bg'], ['mark-vocab', 'mark-vocab-bg'],
]
const NON_TEXT: [string, string][] = [['border-input', 'bg'], ['border-input', 'surface']]

describe.each([
  ['light', light],
  ['dark', dark],
])('%s tokens', (_mode, palette) => {
  it.each(TEXT)('%s on %s reaches 4.5:1 for text', (foreground, background) => {
    // Arrange
    const pair = [palette[foreground], palette[background]]
    // Act
    const value = ratio(...pair)
    // Assert
    expect(pair.every(Boolean)).toBe(true)
    expect(value).toBeGreaterThanOrEqual(4.5)
  })

  it.each(NON_TEXT)('%s on %s reaches 3:1 for control boundaries', (foreground, background) => {
    // Arrange
    const pair = [palette[foreground], palette[background]]
    // Act
    const value = ratio(...pair)
    // Assert
    expect(pair.every(Boolean)).toBe(true)
    expect(value).toBeGreaterThanOrEqual(3)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm -C frontend exec vitest run src/styles/tokens.contrast.test.ts`
Expected: FAIL — `fg-secondary`, `primary-pressed`, `primary-soft`, `border-input`, `band` are missing (`expect(pair.every(Boolean)).toBe(true)` fails) and `#fff` short hex values are not read.

- [ ] **Step 3: Rewrite `tokens.css`**

`frontend/src/styles/tokens.css` (whole file):
```css
/* Design tokens — the ONLY place raw values live. Tailwind generates utilities from @theme.
   Palette/radius/shadow defaults are wiped: only semantic roles exist (bg-primary, text-muted…).
   Visual language and contrast table: /DESIGN.md. Contrast is pinned by tokens.contrast.test.ts. */
@import 'tailwindcss';

@theme {
  --color-*: initial;
  --radius-*: initial;
  --shadow-*: initial;

  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, Roboto, 'Helvetica Neue', Arial, sans-serif;

  --color-bg: #ffffff;
  --color-surface: #f6f9fc;
  --color-border: #e3e8ee;
  --color-border-input: #7a90a8;
  --color-fg: #0d253d;
  --color-fg-secondary: #273951;
  --color-muted: #61718a;
  --color-primary: #533afd;
  --color-primary-pressed: #2e2b8c;
  --color-primary-soft: #eeebff;
  --color-primary-contrast: #ffffff;
  --color-danger: #c0123c;
  --color-success: #0b7a3b;
  --color-warning: #9a5700;
  --color-scrim: rgb(13 37 61 / 40%);
  --color-band: #f1efff;
  --color-mark-error: #c0123c;
  --color-mark-error-bg: #fdeef1;
  --color-mark-suggestion: #9a5700;
  --color-mark-suggestion-bg: #fff4e0;
  --color-mark-vocab: #7a35c9;
  --color-mark-vocab-bg: #f4edfc;

  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-full: 999rem;

  /* Blue-tinted shadows read as depth on white without greying it; Tailwind inlines these, so dark mode keeps them. */
  --shadow-sm: 0 0.0625rem 0.125rem rgb(0 55 112 / 8%);
  --shadow-md: 0 0.25rem 0.75rem rgb(0 55 112 / 8%);
  --shadow-lg: 0 1rem 2.5rem -0.5rem rgb(0 55 112 / 16%);
  /* Spread-only outline for editor chips: grows the tint without padding, so glyph positions never move. */
  --shadow-chip: 0 0 0 0.125rem var(--color-primary-soft);

  --z-index-dropdown: 10;
  --z-index-sticky: 20;
  --z-index-overlay: 30;
  --z-index-toast: 40;

  --container-content: 80rem;
  --container-sidebar: 20rem;
  --container-main: 44rem;
  --container-sheet: 36rem;
}

/* Dark mode = same roles, new values. Components never use `dark:`. */
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #0b1a2b;
    --color-surface: #10233a;
    --color-border: #22384f;
    --color-border-input: #5f7894;
    --color-fg: #e8eef5;
    --color-fg-secondary: #c3cfdc;
    --color-muted: #9aabbf;
    --color-primary: #9d90ff;
    --color-primary-pressed: #c2baff;
    --color-primary-soft: #1d2350;
    --color-primary-contrast: #0b1a2b;
    --color-danger: #ff8095;
    --color-success: #5fd38d;
    --color-warning: #f2b54a;
    --color-scrim: rgb(0 0 0 / 60%);
    --color-band: #121c3f;
    --color-mark-error: #ff8095;
    --color-mark-error-bg: #3a1622;
    --color-mark-suggestion: #f2b54a;
    --color-mark-suggestion-bg: #33250b;
    --color-mark-vocab: #c9a7ff;
    --color-mark-vocab-bg: #2a1d4a;
  }
}
```

`frontend/src/styles/global.css` — replace the `body` rule:
```css
  body {
    margin: 0;
    font-family: var(--font-sans);
    font-feature-settings: 'ss01';
    color: var(--color-fg);
    background: var(--color-bg);
  }
```

`frontend/src/utils/utils.ts` — teach tailwind-merge the new containers:
```ts
    theme: { container: ['content', 'sidebar', 'main', 'sheet'] },
```

- [ ] **Step 4: Run the contrast test**

Run: `pnpm -C frontend exec vitest run src/styles/tokens.contrast.test.ts`
Expected: PASS (58 tests).

- [ ] **Step 5: Write the failing primitive tests**

Append to `frontend/src/components/ui/Button/Button.test.tsx` (inside the `describe`):
```tsx
  it('is a pill in its filled and outlined variants', () => {
    // Arrange
    render(
      <>
        <Button variant="primary">Save</Button>
        <Button>Cancel</Button>
      </>,
    )
    // Act
    const buttons = screen.getAllByRole('button')
    // Assert
    for (const button of buttons) expect(button).toHaveClass('rounded-full')
  })

  it('gives icon buttons a round touch-sized target', () => {
    // Arrange
    const label = 'Close'
    // Act
    render(<Button variant="icon" aria-label={label}>×</Button>)
    // Assert
    expect(screen.getByRole('button', { name: 'Close' })).toHaveClass('size-11', 'rounded-full', 'cursor-pointer')
  })
```

Append to `frontend/src/components/ui/PageHeading/PageHeading.test.tsx`:
```tsx
  it('forwards its ref so the workspace can move focus to it', () => {
    // Arrange
    const ref = createRef<HTMLHeadingElement>()
    // Act
    render(<PageHeading ref={ref}>Entry</PageHeading>)
    // Assert
    expect(ref.current).toBe(screen.getByRole('heading', { level: 1, name: 'Entry' }))
  })
```
(add `import { createRef } from 'react'`).

`frontend/src/components/ui/Card/Card.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Card } from '.'

describe('Card', () => {
  it('renders the element it is asked for on the card surface', () => {
    // Arrange
    const label = 'Progress'
    // Act
    render(<Card as="section" aria-label={label}>Body</Card>)
    // Assert
    expect(screen.getByRole('region', { name: 'Progress' })).toHaveClass('rounded-lg', 'border-border', 'bg-bg')
  })

  it('is a plain block by default and lets callers override its classes', () => {
    // Arrange
    const extra = 'bg-surface'
    // Act
    render(<Card className={extra}>Body</Card>)
    // Assert
    const card = screen.getByText('Body')
    expect(card.tagName).toBe('DIV')
    expect(card).toHaveClass('bg-surface')
    expect(card).not.toHaveClass('bg-bg')
  })
})
```

- [ ] **Step 6: Run them to verify they fail**

Run: `pnpm -C frontend exec vitest run src/components/ui`
Expected: FAIL — `rounded-full`/`size-11` missing, `ref` not forwarded, `Card` module not found.

- [ ] **Step 7: Restyle the primitives**

`frontend/src/components/ui/Button/Button.tsx`:
```tsx
import type { ComponentProps } from 'react'
import { cn } from '@/utils/utils'

// Pills for actions, a round icon target, and the inline variant that sits inside running text (highlights).
const variants = {
  primary: 'min-h-11 rounded-full bg-primary px-5 text-sm font-medium text-primary-contrast shadow-sm hover:bg-primary-pressed',
  secondary: 'min-h-11 rounded-full border border-border-input bg-bg px-5 text-sm font-medium text-fg hover:border-primary hover:text-primary',
  ghost: 'min-h-11 rounded-full px-4 text-sm font-medium text-fg-secondary hover:bg-surface hover:text-fg',
  icon: 'size-11 shrink-0 rounded-full text-fg-secondary hover:bg-surface hover:text-fg',
  inline: 'inline rounded-sm px-0.5',
} as const

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: keyof typeof variants
}

export function Button({ variant = 'secondary', type = 'button', className, ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex cursor-pointer items-center justify-center gap-2 transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        className,
      )}
      {...rest}
    />
  )
}
```

`frontend/src/components/ui/Card/Card.tsx`:
```tsx
import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/utils/utils'

export interface CardProps extends ComponentPropsWithoutRef<'section'> {
  as?: 'div' | 'section'
}

export function Card({ as: Element = 'div', className, ...rest }: CardProps) {
  return <Element className={cn('rounded-lg border border-border bg-bg p-4 shadow-sm md:p-6', className)} {...rest} />
}
```
`frontend/src/components/ui/Card/index.ts`: `export * from './Card'`

`frontend/src/components/ui/PageHeading/PageHeading.tsx`:
```tsx
import type { ReactNode, Ref } from 'react'

export interface PageHeadingProps {
  children: ReactNode
  ref?: Ref<HTMLHeadingElement>
}

// tabIndex -1 lets the workspace move focus here after a navigation without adding a tab stop.
export function PageHeading({ children, ref }: PageHeadingProps) {
  return (
    <h1 ref={ref} tabIndex={-1} className="text-3xl font-light tracking-tight text-fg">
      {children}
    </h1>
  )
}
```

Class-only changes (replace the class string, nothing else):
- `Badge.tsx` base: `'inline-flex items-center rounded-full border bg-surface px-2 py-0.5 text-xs font-medium tabular-nums'`
- `Select.tsx`: `'min-h-11 cursor-pointer rounded-md border border-border-input bg-bg px-3 text-sm text-fg shadow-sm disabled:cursor-not-allowed'`
- `Textarea.tsx`: `'min-h-48 w-full rounded-lg border border-border-input bg-bg p-4 text-base leading-relaxed text-fg shadow-sm read-only:bg-surface'`
- `Field.tsx` label: `'text-sm font-medium text-fg-secondary'`
- `TextLink.tsx`: `'font-medium text-primary underline underline-offset-4 hover:text-primary-pressed'`
- `EmptyState.tsx` wrapper: `'flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-surface p-8 text-center'`

`frontend/src/components/ui/ErrorState/ErrorState.tsx` — the box becomes a `Card`:
```tsx
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export interface ErrorStateProps {
  message: string
  onRetry: () => void
  retryLabel?: string
  retrying?: boolean
}

export function ErrorState({ message, onRetry, retryLabel = 'Try again', retrying = false }: ErrorStateProps) {
  return (
    <Card role="alert" className="flex flex-col items-start gap-3 border-danger p-4 text-sm shadow-none md:p-4">
      <p>{message}</p>
      <Button onClick={onRetry} disabled={retrying}>
        {retryLabel}
      </Button>
    </Card>
  )
}
```

`frontend/src/features/feedback/MistakePanel.tsx` — swap the `<section …>` wrapper for the card (same attributes):
```tsx
    <Card as="section" id={id} aria-labelledby={titleId} className="flex flex-col items-start gap-3 bg-surface p-4 md:p-4">
      …unchanged children…
    </Card>
```
(add `import { Card } from '@/components/ui/Card'`).

- [ ] **Step 8: Write the root `DESIGN.md`**

`DESIGN.md` (repo root):
````markdown
# Language Journal — visual language

A calm product-dashboard look inspired by Stripe's dashboard, adapted for one writing screen. This file is the
design intent; `frontend/DESIGN.md` maps it to tokens and primitives. Raw values live only in
`frontend/src/styles/tokens.css`.

## Principles
- The writing is the content: white canvas, ink text, colour only where it carries meaning (actions, marks, status).
- One filled primary action per region (composer: "Get feedback"; sidebar: "New entry").
- Depth from hairlines and soft blue-tinted shadows, never from heavy greys.
- Motion explains where something came from (a sheet slides from its edge) and is skipped when the OS asks.

## Colour roles
| Role | Light | Dark | Use |
|---|---|---|---|
| `bg` / `surface` | `#ffffff` / `#f6f9fc` | `#0b1a2b` / `#10233a` | canvas / soft panels, read-only fields |
| `border` / `border-input` | `#e3e8ee` / `#7a90a8` | `#22384f` / `#5f7894` | hairlines / control boundaries (≥3:1) |
| `fg` / `fg-secondary` / `muted` | `#0d253d` / `#273951` / `#61718a` | `#e8eef5` / `#c3cfdc` / `#9aabbf` | ink / labels, meta / hints |
| `primary` / `primary-pressed` / `primary-soft` | `#533afd` / `#2e2b8c` / `#eeebff` | `#9d90ff` / `#c2baff` / `#1d2350` | actions, links, focus / hover / selected rows, chips |
| `danger` / `success` / `warning` | `#c0123c` / `#0b7a3b` / `#9a5700` | `#ff8095` / `#5fd38d` / `#f2b54a` | status text and badges |
| `mark-error` / `-suggestion` / `-vocab` (+ `-bg`) | `#c0123c` / `#9a5700` / `#7a35c9` | `#ff8095` / `#f2b54a` / `#c9a7ff` | feedback marks; kind also shown by underline style |
| `band` | `#f1efff` | `#121c3f` | the gradient band behind the header only |

Every text pair is ≥4.5:1 and every control boundary ≥3:1 in both modes; the full table is in the P6 plan and
`tokens.contrast.test.ts` fails the build if a value drifts.

## Type
System stack (`-apple-system, Segoe UI, Roboto…`) with `font-feature-settings: "ss01"`. Display headings light (300)
with tight tracking (`text-3xl font-light tracking-tight`); controls and labels 400–500; numbers `tabular-nums`.

## Space, layout, shape
8px grid (Tailwind's 0.25rem scale, even steps). Header, then sidebar `20rem` + main column `≤44rem` centred;
insights sheet `36rem` from the right (bottom sheet on phones). Radii 6 / 8 / 12px (`rounded-sm|md|lg`); actions are
pills (`rounded-full`). Shadows: `sm` resting cards and inputs, `md` popovers, `lg` sheets and toasts.

## Components
- **Buttons:** primary = filled indigo pill; secondary = white pill with input-border outline, indigo on hover;
  ghost = text pill; icon = 44px round target. Disabled = 60% opacity + not-allowed cursor.
- **Inputs:** white, `border-input`, `rounded-md` (selects) / `rounded-lg` (editor), visible indigo focus ring.
- **Cards:** white, hairline border, `shadow-sm`, `rounded-lg`; soft cards (`surface`) for secondary panels.
- **Badges:** pill chips on `surface`, tone colour on text and border.
- **Sheets:** white panel, hairline edge, `shadow-lg`, scrim `fg` at 40%; slide with a short spring.
- **Tabs:** segmented pill; a white indicator slides under the selected tab.
- **Toasts:** bottom right (bottom centre on phones), white card with a tone stripe and icon.
- **Tooltips:** ink background, white text, small; on focus and hover, Esc closes.
- **Skeletons:** `border`-coloured pulsing blocks in the shape of what is loading.
- **Editor chips:** `[word]` gets a `primary-soft` tint with a spread-only shadow — no padding, so the text never moves.

## Do / Don't
- Do use roles (`text-muted`), never raw colours; add a token when a value is missing.
- Do keep one filled button per region; use secondary or ghost for the rest.
- Do encode meaning twice (colour + underline style, colour + word).
- Don't animate layout or anything over 300ms; don't animate when reduced motion is on.
- Don't use shadows for separation inside a card — use spacing or a hairline.
- Don't put text on `band`, `scrim` or `primary-soft` without checking the table above.
````

- [ ] **Step 9: Update `frontend/DESIGN.md`**

Replace the token table rows and the primitive rows that changed:
```markdown
| Color roles | `--color-bg, surface, border, border-input, fg, fg-secondary, muted, primary, primary-pressed, primary-soft, primary-contrast, danger, success, warning, scrim, band` | `bg-surface`, `text-fg-secondary`, `border-border-input`, `bg-primary hover:bg-primary-pressed`, `bg-linear-to-b from-band to-bg` |
| Shape | `--radius-sm, md, lg, full`, `--shadow-sm, md, lg, chip` | `rounded-lg`, `shadow-lg`, `shadow-chip` |
| Layout | `--container-content` (80rem), `sidebar` (20rem), `main` (44rem), `sheet` (36rem), `--font-sans` | `max-w-content`, `w-sidebar`, `max-w-main`, `max-w-sheet` |
```
Replace the mark-contrast sentence with: `Mark contrast (computed, pinned by src/styles/tokens.contrast.test.ts): text fg on each tint ≥12.7:1; mark colour on its tint ≥5.1:1 light / ≥6.6:1 dark. Visual intent and the full table: /DESIGN.md.`
Primitive rows: `Button` → ``primary`, `secondary` (default), `ghost`, `icon` (44px round, needs `aria-label`), `inline` | pills (`rounded-full`) except `icon`/`inline`; …rest unchanged``; add
```markdown
| `Card` | `as`: `div` (default), `section` | hairline card, `shadow-sm`; override padding/background with `className` |
| `PageHeading` | — | `h1`, light 300, `tabIndex -1`, takes `ref` so the workspace can focus it |
```

- [ ] **Step 10: Run the frontend gate**

Run: `pnpm -C frontend verify`
Expected: `ALL GATES GREEN` (Lighthouse desktop 100s, mobile ≥ 90).

- [ ] **Step 11: Commit**

```bash
git add DESIGN.md frontend/DESIGN.md frontend/src/styles frontend/src/utils/utils.ts frontend/src/components/ui frontend/src/features/feedback/MistakePanel.tsx
git commit -m "feat(frontend): Stripe-inspired tokens, DESIGN.md and pill primitives"
```

---

### Task 2: `motion`, the Icon primitive and the Sheet

**Files:**
- Modify: `frontend/package.json`, `frontend/pnpm-lock.yaml`, `frontend/src/providers/AppProviders.tsx`, `frontend/DESIGN.md`
- Create: `frontend/src/providers/motionFeatures.ts`, `frontend/src/components/ui/Icon/{Icon.tsx,Icon.test.tsx,index.ts}`, `frontend/src/components/ui/Sheet/{Sheet.tsx,SheetPanel.tsx,focus.ts,Sheet.test.tsx,Sheet.motion.test.tsx,index.ts}`

**Interfaces:**
- Consumes: `Button` (`icon` variant), tokens from Task 1.
- Produces:
  - `Icon({ name: IconName, className?: string })`, `IconName = 'close' | 'check' | 'alert' | 'menu' | 'chart' | 'plus'` — always `aria-hidden`.
  - `Sheet({ open: boolean, onClose: () => void, side: SheetSide, title: string, description?: string, children: ReactNode })`, `SheetSide = 'left' | 'right' | 'bottom'`. Renders a portal into `<body>`: scrim + `role="dialog" aria-modal="true"` named by its `h2` title, described by `description`. On open: focus the heading, lock page scroll. Esc (propagation stopped), scrim click and the "Close" icon button call `onClose`. Tab/Shift+Tab wrap inside. On close: focus returns to the element focused before opening **only if** focus is still inside the panel or on `<body>`.
  - `AppProviders` wraps children in `<LazyMotion features={loadMotionFeatures} strict><MotionConfig reducedMotion="user">`.

SmoothUI's drawer is a vaul wrapper (drag gestures, its own portal and focus handling). We keep its motion — spring slide from the edge, fading backdrop, `useReducedMotion` → instant — on our own focus-trapped panel, and drop vaul, the infinite handle pulse and the content stagger (each costs main-thread work on open for little value).

- [ ] **Step 1: Add the dependency**

Run: `pnpm -C frontend add motion@14.1.0`
Expected: `+ motion 14.1.0` in `dependencies`; lockfile updated.

- [ ] **Step 2: Write the failing Sheet and Icon tests**

`frontend/src/components/ui/Icon/Icon.test.tsx`:
```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Icon } from '.'

describe('Icon', () => {
  it('is decorative, so the control around it carries the name', () => {
    // Arrange
    const name = 'close'
    // Act
    const { container } = render(<Icon name={name} />)
    // Assert
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
})
```

`frontend/src/components/ui/Sheet/Sheet.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Button } from '@/components/ui/Button'
import { Sheet } from '.'

function Harness({ onDocumentEscape }: { onDocumentEscape?: () => void }) {
  const [open, setOpen] = useState(false)
  const outside = useRef<HTMLButtonElement>(null)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open insights</Button>
      <Button ref={outside} onClick={onDocumentEscape}>Outside</Button>
      <Sheet open={open} onClose={() => setOpen(false)} side="right" title="Insights" description="How you are doing.">
        <Button>First</Button>
        <Button
          onClick={() => {
            outside.current?.focus()
            setOpen(false)
          }}
        >
          Move on
        </Button>
      </Sheet>
    </>
  )
}

async function openSheet() {
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getByRole('button', { name: 'Open insights' }))
  return user
}

describe('Sheet', () => {
  afterEach(() => vi.restoreAllMocks())

  it('is a named, described modal dialog that moves focus to its heading', async () => {
    // Arrange + Act
    await openSheet()
    // Assert
    const dialog = screen.getByRole('dialog', { name: 'Insights' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleDescription('How you are doing.')
    expect(screen.getByRole('heading', { level: 2, name: 'Insights' })).toHaveFocus()
  })

  it('closes on Escape and returns focus to the button that opened it', async () => {
    // Arrange
    const user = await openSheet()
    // Act
    await user.keyboard('{Escape}')
    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open insights' })).toHaveFocus()
  })

  it('closes from its Close button', async () => {
    // Arrange
    const user = await openSheet()
    // Act
    await user.click(screen.getByRole('button', { name: 'Close' }))
    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes when the backdrop is clicked', async () => {
    // Arrange
    const user = await openSheet()
    // The scrim is decorative (role="presentation"), so it has no accessible handle to query by.
    const scrim = document.querySelector('.bg-scrim')
    // Act
    if (scrim) await user.click(scrim)
    // Assert
    expect(scrim).not.toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps Tab and Shift+Tab inside the dialog', async () => {
    // Arrange
    const user = await openSheet()
    // Act + Assert
    await user.tab()
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
    await user.tab()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Move on' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Move on' })).toHaveFocus()
  })

  it('does not pull focus back when something outside took it while closing', async () => {
    // Arrange
    const user = await openSheet()
    // Act
    await user.click(screen.getByRole('button', { name: 'Move on' }))
    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Outside' })).toHaveFocus()
  })

  it('lets Escape close only the sheet, not handlers listening behind it', async () => {
    // Arrange
    const behind = vi.fn()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') behind()
    }
    document.addEventListener('keydown', onKeyDown)
    const user = await openSheet()
    // Act
    await user.keyboard('{Escape}')
    document.removeEventListener('keydown', onKeyDown)
    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(behind).not.toHaveBeenCalled()
  })

  it('locks page scroll while open', async () => {
    // Arrange
    const user = await openSheet()
    expect(document.body).toHaveClass('overflow-hidden')
    // Act
    await user.keyboard('{Escape}')
    // Assert
    expect(document.body).not.toHaveClass('overflow-hidden')
  })

  it('starts off-screen on its own side so it can slide in', async () => {
    // Arrange + Act
    await openSheet()
    // Assert
    expect(screen.getByRole('dialog').getAttribute('style')).toContain('translateX(100%)')
  })
})
```

`frontend/src/components/ui/Sheet/Sheet.motion.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Sheet } from '.'

// motion caches the OS preference at module load; mocking the hook is the only way to flip it per file.
vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('motion/react')>()),
  useReducedMotion: () => true,
}))

describe('Sheet with reduced motion', () => {
  it('appears in place instead of sliding', () => {
    // Arrange
    const onClose = vi.fn()
    // Act
    render(
      <Sheet open onClose={onClose} side="bottom" title="Entries">
        <p>List</p>
      </Sheet>,
    )
    // Assert
    expect(screen.getByRole('dialog').getAttribute('style') ?? '').not.toContain('translate')
  })
})
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm -C frontend exec vitest run src/components/ui/Sheet src/components/ui/Icon`
Expected: FAIL — modules `.` not found.

- [ ] **Step 4: Implement Icon**

`frontend/src/components/ui/Icon/Icon.tsx`:
```tsx
import { cn } from '@/utils/utils'

// Inline strokes instead of an icon package: six glyphs do not justify a dependency.
const PATHS = {
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7',
  alert: 'M12 8v5m0 3.5v.5M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  menu: 'M4 7h16M4 12h16M4 17h10',
  chart: 'M4 19V5m0 14h16M8 15l3-4 3 2 5-6',
  plus: 'M12 5v14M5 12h14',
} as const

export type IconName = keyof typeof PATHS

export interface IconProps {
  name: IconName
  className?: string
}

export function Icon({ name, className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={cn('size-5 shrink-0', className)}>
      <path d={PATHS[name]} />
    </svg>
  )
}
```
`index.ts`: `export * from './Icon'`

- [ ] **Step 5: Implement the Sheet**

`frontend/src/components/ui/Sheet/focus.ts`:
```ts
// Adapted from SmoothUI (MIT), https://smoothui.dev
import { useEffect, useRef, type KeyboardEvent, type RefObject } from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Tab and Shift+Tab wrap inside the dialog; from the heading (tabIndex -1, focused on open) they enter at the edge.
export function trapTab(event: KeyboardEvent<HTMLElement>, container: HTMLElement): void {
  if (event.key !== 'Tab') return
  const items = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
  const first = items[0]
  const last = items.at(-1)
  if (!first || !last) {
    event.preventDefault()
    return
  }
  const active = document.activeElement
  const edge = event.shiftKey ? first : last
  if (active === edge || !items.some((item) => item === active)) {
    event.preventDefault()
    ;(event.shiftKey ? last : first).focus()
  }
}

// Focus moves to the heading on open and back to the opener on close — unless the user already moved on (picked an
// entry whose heading took focus), which closing must not undo. By cleanup time the panel is out of the DOM, so
// focus that was inside it has fallen back to <body>.
export function useDialogFocus<T extends HTMLElement>(): RefObject<T | null> {
  const headingRef = useRef<T>(null)
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const panel = headingRef.current?.closest('[role="dialog"]') ?? null
    headingRef.current?.focus()
    return () => {
      const active = document.activeElement
      const abandoned = active === null || active === document.body || (panel?.contains(active) ?? false)
      if (abandoned) opener?.focus()
    }
  }, [])
  return headingRef
}

// A class, not an inline style: the page behind a modal sheet must not scroll under the user's finger.
export function useScrollLock(): void {
  useEffect(() => {
    document.body.classList.add('overflow-hidden')
    return () => document.body.classList.remove('overflow-hidden')
  }, [])
}
```

`frontend/src/components/ui/Sheet/SheetPanel.tsx`:
```tsx
// Adapted from SmoothUI (MIT), https://smoothui.dev
import { m, useReducedMotion } from 'motion/react'
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/utils/utils'
import { trapTab, useDialogFocus, useScrollLock } from './focus'

export type SheetSide = 'left' | 'right' | 'bottom'

const SPRING = { type: 'spring', bounce: 0, duration: 0.3 } as const
const INSTANT = { duration: 0 } as const
const OFFSCREEN = { left: { x: '-100%' }, right: { x: '100%' }, bottom: { y: '100%' } } as const
const sideClasses = {
  left: 'inset-y-0 left-0 w-full max-w-sidebar border-r',
  right: 'inset-y-0 right-0 w-full max-w-sheet border-l',
  bottom: 'inset-x-0 top-12 bottom-0 rounded-t-lg border-t',
} as const

export interface SheetPanelProps {
  onClose: () => void
  side: SheetSide
  title: string
  description?: string
  children: ReactNode
}

export function SheetPanel({ onClose, side, title, description, children }: SheetPanelProps) {
  const reduce = useReducedMotion() ?? false
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const headingRef = useDialogFocus<HTMLHeadingElement>()
  useScrollLock()
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      // Listeners behind the modal (an open mistake panel) must not close too.
      event.stopPropagation()
      onClose()
    } else if (panelRef.current) trapTab(event, panelRef.current)
  }
  return (
    <>
      <m.div role="presentation" className="fixed inset-0 z-overlay bg-scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={reduce ? INSTANT : { duration: 0.2 }} />
      <m.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn('fixed z-overlay flex flex-col overflow-y-auto border-border bg-bg shadow-lg', sideClasses[side])}
        onKeyDown={onKeyDown}
        initial={reduce ? false : OFFSCREEN[side]}
        animate={{ x: 0, y: 0 }}
        exit={reduce ? { opacity: 0 } : OFFSCREEN[side]}
        transition={reduce ? INSTANT : SPRING}
      >
        <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-border bg-bg px-4 py-3 md:px-6">
          <div className="flex flex-col gap-1">
            <h2 id={titleId} ref={headingRef} tabIndex={-1} className="text-xl font-light tracking-tight">
              {title}
            </h2>
            {description && <p id={descriptionId} className="text-sm text-muted">{description}</p>}
          </div>
          <Button variant="icon" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </Button>
        </div>
        <div className="flex-1 px-4 py-4 md:px-6">{children}</div>
      </m.div>
    </>
  )
}
```

`frontend/src/components/ui/Sheet/Sheet.tsx`:
```tsx
// Adapted from SmoothUI (MIT), https://smoothui.dev
import { AnimatePresence } from 'motion/react'
import { createPortal } from 'react-dom'
import { SheetPanel, type SheetPanelProps } from './SheetPanel'

export type { SheetSide } from './SheetPanel'

export interface SheetProps extends SheetPanelProps {
  open: boolean
}

// Portalled to <body> so no ancestor's overflow or stacking context can clip it; AnimatePresence keeps the panel
// mounted until its exit slide ends.
export function Sheet({ open, ...panel }: SheetProps) {
  return createPortal(<AnimatePresence>{open && <SheetPanel key="sheet" {...panel} />}</AnimatePresence>, document.body)
}
```
`index.ts`: `export * from './Sheet'`

- [ ] **Step 6: Load motion features lazily in the app**

`frontend/src/providers/motionFeatures.ts`:
```ts
// Its own module so Vite splits the animation features (~20 kB gz) out of the entry chunk; they load after first paint.
export { domAnimation as default } from 'motion/react'
```

`frontend/src/providers/AppProviders.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { isHTTPError } from 'ky'
import { LazyMotion, MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'

// A 4xx will answer the same way twice; only transport and server failures are worth another attempt.
const retryOnce = (count: number, error: Error) => !(isHTTPError(error) && error.response.status < 500) && count < 1

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: retryOnce, staleTime: 30_000 } } })

const loadMotionFeatures = () => import('./motionFeatures').then((module) => module.default)

// `strict` makes a stray full `motion.*` import (which would bundle every feature) throw in development.
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <LazyMotion features={loadMotionFeatures} strict>
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </LazyMotion>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 7: Run the tests**

Run: `pnpm -C frontend exec vitest run src/components/ui/Sheet src/components/ui/Icon src/providers`
Expected: PASS (Sheet 9, Sheet reduced-motion 1, Icon 1, AppProviders 1).

- [ ] **Step 8: Document the primitives**

Add to the primitives table in `frontend/DESIGN.md`:
```markdown
| `Icon` | `name`: `close`, `check`, `alert`, `menu`, `chart`, `plus` | inline 24px stroke SVG, `aria-hidden`; the control around it carries the name |
| `Sheet` | `side`: `left`, `right`, `bottom` | modal dialog in a portal (SmoothUI drawer motion, MIT): heading focused on open, Esc/scrim/Close dismiss, Tab trapped, focus restored unless the user moved on, page scroll locked |
```
Under "## 3. Composition" add: `Motion: only \`m.*\` from \`motion/react\` (LazyMotion is strict); every animated element skips offsets and uses \`{ duration: 0 }\` when \`useReducedMotion()\` is true. Springs: \`{ type: 'spring', bounce: 0–0.1, duration: 0.25–0.3 }\`.`

- [ ] **Step 9: Run the frontend gate**

Run: `pnpm -C frontend verify`
Expected: `ALL GATES GREEN`.

- [ ] **Step 10: Commit**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml frontend/src/providers frontend/src/components/ui/Icon frontend/src/components/ui/Sheet frontend/DESIGN.md
git commit -m "feat(frontend): motion with lazy features, Icon and a focus-trapped Sheet

New dependency motion@14.1.0: animation layer the ported SmoothUI primitives are written against (sheet slide, tab indicator, toast, tooltip); used as m + lazily loaded domAnimation, ~5 kB gz up front."
```

---
### Task 3: AnimatedTabs, Skeleton, Toast and Tooltip

Library only: nothing in the app uses these until Tasks 7 and 9, so no journey changes. fallow counts test files as entry points (that is how `src/test/helpers.ts`' test-only exports pass today), so primitives exercised only by their tests do not trip "unused exports".

**Files:**
- Create: `frontend/src/components/ui/AnimatedTabs/{AnimatedTabs.tsx,AnimatedTabs.test.tsx,index.ts}`, `frontend/src/components/ui/Skeleton/{Skeleton.tsx,Skeleton.test.tsx,index.ts}`, `frontend/src/components/ui/Toast/{ToastContext.ts,useToast.ts,ToastProvider.tsx,ToastItem.tsx,Toast.test.tsx,Toast.motion.test.tsx,index.ts}`, `frontend/src/components/ui/Tooltip/{Tooltip.tsx,Tooltip.test.tsx,index.ts}`
- Modify: `frontend/src/components/ui/Button/Button.tsx` (`tab` variant), `frontend/src/components/ui/LoadingState/{LoadingState.tsx,LoadingState.test.tsx}`, `frontend/src/providers/AppProviders.tsx`, `frontend/src/test/renderWithProviders.tsx`, `frontend/DESIGN.md`

**Interfaces:**
- Consumes: `Button`, `Icon`, `m`/`AnimatePresence`/`useReducedMotion` from `motion/react`.
- Produces:
  - `AnimatedTabs({ label: string, idPrefix: string, tabs: readonly AnimatedTab[], value: string, onChange: (id: string) => void })`, `AnimatedTab = { id: string; label: string }`, `tabId(prefix, id)`, `panelId(prefix, id)`. Controlled; 2–4 equal-width tabs; ArrowLeft/Right (wrapping), Home, End move selection and focus; only the selected tab is in the tab order and has `aria-controls`.
  - `Skeleton({ className?: string })` — `aria-hidden` pulsing block. `LoadingState({ label, children? })` — with children, the label becomes `sr-only` and the children (skeletons) show.
  - `ToastProvider({ children, duration?: number = 5000 })`, `useToast(): { show(toast: ToastInput): void }`, `ToastInput = { message: string; tone?: 'success' | 'danger' | 'neutral' }`. Each toast is `role="status"`, has a "Dismiss notification" icon button, auto-dismisses after `duration`, at most three on screen. Without a provider `show` is a no-op.
  - `Tooltip({ content: string, align?: 'start' | 'center' | 'end', children })` — wraps `children` in a focusable trigger; shows `role="tooltip"` on focus or hover, links it with `aria-describedby`, hides on blur, mouse leave or Esc.
  - `AppProviders` and `renderWithProviders` include `<ToastProvider>`.

Adaptation notes (SmoothUI sources fetched from `https://smoothui.dev/r/{animated-tabs,skeleton-loader,basic-toast,animated-tooltip}.json`): the tabs' `layoutId` indicator needs `domMax` (~14 kB gz more than `domAnimation`), so one indicator slides by whole tab widths with a transform instead; the toast drops `lucide-react` and the per-toast `createPortal` in favour of one fixed viewport; the tooltip drops the `matchMedia` effect (state set inside an effect fails `react-hooks`) and listens for Esc on `document` only while open (an `onKeyDown` on a `span` fails `jsx-a11y/no-static-element-interactions`); the skeleton keeps SmoothUI's `animate-pulse` block (no motion needed, and `global.css` already stops it under reduced motion).

- [ ] **Step 1: Write the failing tests**

`frontend/src/components/ui/AnimatedTabs/AnimatedTabs.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { AnimatedTabs } from '.'

const TABS = [
  { id: 'original', label: 'Your text' },
  { id: 'corrected', label: 'Corrected' },
  { id: 'notes', label: 'Notes' },
]

function Harness() {
  const [value, setValue] = useState('original')
  return <AnimatedTabs label="Text version" idPrefix="tv" tabs={TABS} value={value} onChange={setValue} />
}

const tab = (name: string) => screen.getByRole('tab', { name })

describe('AnimatedTabs', () => {
  it('is a named tablist with only the selected tab in the tab order', () => {
    // Arrange + Act
    render(<Harness />)
    // Assert
    expect(screen.getByRole('tablist', { name: 'Text version' })).toBeInTheDocument()
    expect(tab('Your text')).toHaveAttribute('aria-selected', 'true')
    expect(tab('Your text')).toHaveAttribute('tabindex', '0')
    expect(tab('Corrected')).toHaveAttribute('tabindex', '-1')
  })

  it('selects a tab on click', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<Harness />)
    // Act
    await user.click(tab('Corrected'))
    // Assert
    expect(tab('Corrected')).toHaveAttribute('aria-selected', 'true')
    expect(tab('Your text')).toHaveAttribute('aria-selected', 'false')
  })

  it('moves selection and focus with the arrow keys, wrapping at the ends', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(tab('Your text'))
    // Act + Assert
    await user.keyboard('{ArrowLeft}')
    expect(tab('Notes')).toHaveFocus()
    expect(tab('Notes')).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{ArrowRight}')
    expect(tab('Your text')).toHaveFocus()
  })

  it('jumps to the first and last tab with Home and End', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(tab('Corrected'))
    // Act + Assert
    await user.keyboard('{End}')
    expect(tab('Notes')).toHaveFocus()
    await user.keyboard('{Home}')
    expect(tab('Your text')).toHaveFocus()
  })

  it('points only the selected tab at its panel', () => {
    // Arrange + Act
    render(<Harness />)
    // Assert
    expect(tab('Your text')).toHaveAttribute('aria-controls', 'tv-panel-original')
    expect(tab('Corrected')).not.toHaveAttribute('aria-controls')
  })
})
```

`frontend/src/components/ui/Skeleton/Skeleton.test.tsx`:
```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Skeleton } from '.'

describe('Skeleton', () => {
  it('is a decorative pulsing block sized by its caller', () => {
    // Arrange
    const size = 'h-14'
    // Act
    const { container } = render(<Skeleton className={size} />)
    // Assert
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
    expect(container.firstChild).toHaveClass('animate-pulse', 'h-14')
  })
})
```

Append to `frontend/src/components/ui/LoadingState/LoadingState.test.tsx`:
```tsx
  it('shows placeholders and keeps the label for screen readers', () => {
    // Arrange
    const label = 'Loading entries…'
    // Act
    render(
      <LoadingState label={label}>
        <span>placeholder</span>
      </LoadingState>,
    )
    // Assert
    expect(screen.getByRole('status')).toHaveTextContent(label)
    expect(screen.getByText(label)).toHaveClass('sr-only')
    expect(screen.getByText('placeholder')).toBeInTheDocument()
  })
```

`frontend/src/components/ui/Toast/Toast.test.tsx`:
```tsx
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Button } from '@/components/ui/Button'
import { ToastProvider, useToast } from '.'

function Trigger({ message = 'Feedback ready' }: { message?: string }) {
  const { show } = useToast()
  return <Button onClick={() => show({ message, tone: 'success' })}>Notify</Button>
}

const renderToasts = (duration?: number) =>
  render(
    <ToastProvider duration={duration}>
      <Trigger />
    </ToastProvider>,
  )

describe('Toast', () => {
  afterEach(() => vi.useRealTimers())

  it('announces a message as a status and dismisses it on request', async () => {
    // Arrange
    const user = userEvent.setup()
    renderToasts()
    await user.click(screen.getByRole('button', { name: 'Notify' }))
    expect(screen.getByRole('status')).toHaveTextContent('Feedback ready')
    // Act
    await user.click(screen.getByRole('button', { name: 'Dismiss notification' }))
    // Assert
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('dismisses itself after its duration', async () => {
    // Arrange
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderToasts(1000)
    await user.click(screen.getByRole('button', { name: 'Notify' }))
    // Act
    act(() => vi.advanceTimersByTime(1000))
    // Assert
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('keeps at most three on screen, dropping the oldest', async () => {
    // Arrange
    const user = userEvent.setup()
    renderToasts()
    // Act
    for (let i = 0; i < 4; i += 1) await user.click(screen.getByRole('button', { name: 'Notify' }))
    // Assert
    expect(screen.getAllByRole('status')).toHaveLength(3)
  })

  it('does nothing without a provider, so isolated components still render', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<Trigger />)
    // Act
    await user.click(screen.getByRole('button', { name: 'Notify' }))
    // Assert
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
```

`frontend/src/components/ui/Toast/Toast.motion.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '@/components/ui/Button'
import { ToastProvider, useToast } from '.'

vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('motion/react')>()),
  useReducedMotion: () => true,
}))

function Trigger() {
  const { show } = useToast()
  return <Button onClick={() => show({ message: 'Saved' })}>Notify</Button>
}

describe('Toast with reduced motion', () => {
  it('fades in place instead of rising', async () => {
    // Arrange
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )
    // Act
    await user.click(screen.getByRole('button', { name: 'Notify' }))
    // Assert
    expect(screen.getByRole('status').getAttribute('style') ?? '').not.toContain('translate')
  })
})
```

`frontend/src/components/ui/Tooltip/Tooltip.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Tooltip } from '.'

const HINT = 'Counts towards your error rate.'

function renderTooltip() {
  render(
    <Tooltip content={HINT}>
      <span>Error</span>
    </Tooltip>,
  )
  return { user: userEvent.setup(), trigger: screen.getByText('Error').parentElement as HTMLElement }
}

describe('Tooltip', () => {
  it('describes its trigger while focused and hides on blur', async () => {
    // Arrange
    const { user, trigger } = renderTooltip()
    // Act
    await user.tab()
    // Assert
    expect(trigger).toHaveFocus()
    expect(screen.getByRole('tooltip')).toHaveTextContent(HINT)
    expect(trigger).toHaveAccessibleDescription(HINT)
    await user.tab()
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('shows on hover and hides when the pointer leaves', async () => {
    // Arrange
    const { user, trigger } = renderTooltip()
    // Act
    await user.hover(trigger)
    // Assert
    expect(screen.getByRole('tooltip')).toHaveTextContent(HINT)
    await user.unhover(trigger)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('hides on Escape without moving focus', async () => {
    // Arrange
    const { user, trigger } = renderTooltip()
    await user.tab()
    // Act
    await user.keyboard('{Escape}')
    // Assert
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm -C frontend exec vitest run src/components/ui`
Expected: FAIL — `AnimatedTabs`, `Skeleton`, `Toast`, `Tooltip` modules not found; LoadingState ignores children.

- [ ] **Step 3: Implement AnimatedTabs**

Add to the `variants` map in `Button.tsx` (above `inline`):
```ts
  tab: 'relative min-h-11 rounded-full px-4 text-sm font-medium text-fg-secondary hover:text-fg aria-selected:text-fg',
```

`frontend/src/components/ui/AnimatedTabs/AnimatedTabs.tsx`:
```tsx
// Adapted from SmoothUI (MIT), https://smoothui.dev
import { m, useReducedMotion } from 'motion/react'
import type { KeyboardEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/utils/utils'

export interface AnimatedTab {
  id: string
  label: string
}

export interface AnimatedTabsProps {
  label: string
  idPrefix: string
  tabs: readonly AnimatedTab[]
  value: string
  onChange: (id: string) => void
}

const SPRING = { type: 'spring', bounce: 0.05, duration: 0.25 } as const
const columns: Record<number, string> = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }
const indicatorWidths: Record<number, string> = { 2: 'w-1/2', 3: 'w-1/3', 4: 'w-1/4' }
const KEY_STEPS: Record<string, (index: number, count: number) => number> = {
  ArrowRight: (index, count) => (index + 1) % count,
  ArrowLeft: (index, count) => (index - 1 + count) % count,
  Home: () => 0,
  End: (_index, count) => count - 1,
}

export const tabId = (prefix: string, id: string) => `${prefix}-tab-${id}`
export const panelId = (prefix: string, id: string) => `${prefix}-panel-${id}`

// One indicator slides by whole tab widths (a transform, so domAnimation is enough); SmoothUI's layoutId version
// would need the heavier domMax feature set.
export function AnimatedTabs({ label, idPrefix, tabs, value, onChange }: AnimatedTabsProps) {
  const reduce = useReducedMotion() ?? false
  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.id === value))
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = KEY_STEPS[event.key]
    const next = step && tabs[step(index, tabs.length)]
    if (!next) return
    event.preventDefault()
    onChange(next.id)
    document.getElementById(tabId(idPrefix, next.id))?.focus()
  }
  return (
    <div role="tablist" aria-label={label} className={cn('relative inline-grid rounded-full bg-surface p-1', columns[tabs.length])}>
      <span aria-hidden="true" className="pointer-events-none absolute inset-1">
        <m.span className={cn('block h-full rounded-full border border-border bg-bg shadow-sm', indicatorWidths[tabs.length])} initial={false} animate={{ x: `${activeIndex * 100}%` }} transition={reduce ? { duration: 0 } : SPRING} />
      </span>
      {tabs.map((tab, index) => {
        const selected = tab.id === value
        return (
          <Button key={tab.id} id={tabId(idPrefix, tab.id)} role="tab" variant="tab" aria-selected={selected} aria-controls={selected ? panelId(idPrefix, tab.id) : undefined} tabIndex={selected ? 0 : -1} onClick={() => onChange(tab.id)} onKeyDown={(event) => onKeyDown(event, index)}>
            {tab.label}
          </Button>
        )
      })}
    </div>
  )
}
```
`index.ts`: `export * from './AnimatedTabs'`

- [ ] **Step 4: Implement Skeleton and LoadingState children**

`frontend/src/components/ui/Skeleton/Skeleton.tsx`:
```tsx
// Adapted from SmoothUI (MIT), https://smoothui.dev
import { cn } from '@/utils/utils'

export interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return <span aria-hidden="true" className={cn('block animate-pulse rounded-md bg-border', className)} />
}
```
`index.ts`: `export * from './Skeleton'`

`frontend/src/components/ui/LoadingState/LoadingState.tsx`:
```tsx
import type { ReactNode } from 'react'

export interface LoadingStateProps {
  label: string
  children?: ReactNode
}

// With skeletons the label is only for screen readers; the shapes show sighted users what is coming.
export function LoadingState({ label, children }: LoadingStateProps) {
  if (!children) {
    return (
      <div role="status" aria-busy="true" className="py-8 text-center text-sm text-muted">
        {label}
      </div>
    )
  }
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-3">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}
```

- [ ] **Step 5: Implement Toast**

`frontend/src/components/ui/Toast/ToastContext.ts`:
```ts
import { createContext } from 'react'

export type ToastTone = 'success' | 'danger' | 'neutral'

export interface ToastInput {
  message: string
  tone?: ToastTone
}

export interface ToastApi {
  show: (toast: ToastInput) => void
}

// Without a provider (isolated component tests) a toast is simply not shown.
export const ToastContext = createContext<ToastApi>({ show: () => undefined })
```

`frontend/src/components/ui/Toast/useToast.ts`:
```ts
import { use } from 'react'
import { ToastContext, type ToastApi } from './ToastContext'

export function useToast(): ToastApi {
  return use(ToastContext)
}
```

`frontend/src/components/ui/Toast/ToastItem.tsx`:
```tsx
// Adapted from SmoothUI (MIT), https://smoothui.dev
import { m, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon, type IconName } from '@/components/ui/Icon'
import { cn } from '@/utils/utils'
import type { ToastTone } from './ToastContext'

export interface QueuedToast {
  id: number
  message: string
  tone: ToastTone
}

export interface ToastItemProps {
  toast: QueuedToast
  duration: number
  onDismiss: (id: number) => void
}

const SPRING = { type: 'spring', bounce: 0.1, duration: 0.25 } as const
const stripeClasses: Record<ToastTone, string> = { success: 'border-l-success', danger: 'border-l-danger', neutral: 'border-l-primary' }
const iconClasses: Record<ToastTone, string> = { success: 'text-success', danger: 'text-danger', neutral: 'text-primary' }
const icons: Record<ToastTone, IconName> = { success: 'check', danger: 'alert', neutral: 'check' }

export function ToastItem({ toast, duration, onDismiss }: ToastItemProps) {
  const reduce = useReducedMotion() ?? false
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), duration)
    return () => clearTimeout(timer)
  }, [toast.id, duration, onDismiss])
  const hidden = reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }
  return (
    <m.div role="status" className={cn('pointer-events-auto flex items-start gap-3 rounded-lg border border-l-4 border-border bg-bg py-3 pl-4 text-sm text-fg shadow-lg', stripeClasses[toast.tone])} initial={hidden} animate={{ opacity: 1, y: 0, scale: 1 }} exit={hidden} transition={reduce ? { duration: 0 } : SPRING}>
      <Icon name={icons[toast.tone]} className={cn('mt-0.5', iconClasses[toast.tone])} />
      <p className="flex-1 py-0.5">{toast.message}</p>
      <Button variant="icon" aria-label="Dismiss notification" className="-my-2" onClick={() => onDismiss(toast.id)}>
        <Icon name="close" className="size-4" />
      </Button>
    </m.div>
  )
}
```

`frontend/src/components/ui/Toast/ToastProvider.tsx`:
```tsx
// Adapted from SmoothUI (MIT), https://smoothui.dev
import { AnimatePresence } from 'motion/react'
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type ToastApi } from './ToastContext'
import { ToastItem, type QueuedToast } from './ToastItem'

export interface ToastProviderProps {
  children: ReactNode
  duration?: number
}

const MAX_VISIBLE = 3

// One fixed viewport instead of a portal per toast: toasts stack, and the newest never covers an older one.
export function ToastProvider({ children, duration = 5000 }: ToastProviderProps) {
  const [toasts, setToasts] = useState<QueuedToast[]>([])
  const nextId = useRef(0)
  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((toast) => toast.id !== id)), [])
  const api = useMemo<ToastApi>(
    () => ({
      show: ({ message, tone = 'neutral' }) => {
        nextId.current += 1
        const toast = { id: nextId.current, message, tone }
        setToasts((all) => [...all.slice(1 - MAX_VISIBLE), toast])
      },
    }),
    [],
  )
  return (
    <ToastContext value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-toast flex flex-col gap-2 md:left-auto md:w-96">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} duration={duration} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext>
  )
}
```
`index.ts`:
```ts
export * from './ToastContext'
export * from './ToastProvider'
export * from './useToast'
```

- [ ] **Step 6: Implement Tooltip**

`frontend/src/components/ui/Tooltip/Tooltip.tsx`:
```tsx
// Adapted from SmoothUI (MIT), https://smoothui.dev
import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { useEffect, useId, useState, type ReactNode } from 'react'
import { cn } from '@/utils/utils'

export type TooltipAlign = 'start' | 'center' | 'end'

export interface TooltipProps {
  content: string
  align?: TooltipAlign
  children: ReactNode
}

const SPRING = { type: 'spring', bounce: 0.1, duration: 0.25 } as const
// Edge alignment keeps a 12rem tip inside a 375px screen for chips near either edge.
const alignClasses: Record<TooltipAlign, string> = { start: 'left-0', center: 'left-1/2 -translate-x-1/2', end: 'right-0' }

export function Tooltip({ content, align = 'center', children }: TooltipProps) {
  const reduce = useReducedMotion() ?? false
  const [open, setOpen] = useState(false)
  const id = useId()
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])
  const hidden = reduce ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.96 }
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <span tabIndex={0} aria-describedby={open ? id : undefined} className="rounded-sm" onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
        {children}
      </span>
      <AnimatePresence>
        {open && (
          <m.span id={id} role="tooltip" className={cn('pointer-events-none absolute bottom-full z-dropdown mb-2 w-48 rounded-md bg-fg px-3 py-2 text-xs text-bg shadow-md', alignClasses[align])} initial={hidden} animate={{ opacity: 1, y: 0, scale: 1 }} exit={hidden} transition={reduce ? { duration: 0 } : SPRING}>
            {content}
          </m.span>
        )}
      </AnimatePresence>
    </span>
  )
}
```
`index.ts`: `export * from './Tooltip'`

- [ ] **Step 7: Provide toasts app-wide and in tests**

`frontend/src/providers/AppProviders.tsx` — wrap `{children}` inside `MotionConfig`:
```tsx
        <MotionConfig reducedMotion="user">
          <ToastProvider>{children}</ToastProvider>
        </MotionConfig>
```
(add `import { ToastProvider } from '@/components/ui/Toast'`).

`frontend/src/test/renderWithProviders.tsx` — the `wrap` helper:
```tsx
const wrap = (client: QueryClient, route: string, children: ReactNode) => (
  <QueryClientProvider client={client}>
    <ToastProvider>
      <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
    </ToastProvider>
  </QueryClientProvider>
)
```
(add `import { ToastProvider } from '@/components/ui/Toast'`). An empty viewport adds no `status` role, so existing "no status" assertions hold.

- [ ] **Step 8: Run the tests**

Run: `pnpm -C frontend exec vitest run src/components/ui src/providers`
Expected: PASS.

- [ ] **Step 9: Document the primitives**

Add to `frontend/DESIGN.md`:
```markdown
| `Button` `tab` | — | used by `AnimatedTabs`; text turns `fg` when `aria-selected` |
| `AnimatedTabs` | 2–4 tabs | controlled segmented tabs (SmoothUI, MIT); arrows/Home/End; only the selected tab is tabbable and has `aria-controls`; pair with `role="tabpanel"` using `tabId`/`panelId` |
| `Skeleton` | — | `aria-hidden` pulsing block; put skeletons inside `LoadingState` so the label stays for screen readers |
| `Toast` | `tone`: `success`, `danger`, `neutral` | `useToast().show({ message, tone })`; `role="status"`, dismiss button, 5s, max 3 (SmoothUI, MIT) |
| `Tooltip` | `align`: `start`, `center` (default), `end` | focus/hover hint on a focusable trigger, `aria-describedby`, Esc closes (SmoothUI, MIT); for supplementary text only |
```
Update the `LoadingState` row: `| \`LoadingState\` | — | \`role="status"\` + \`aria-busy\`; muted label, or skeleton \`children\` with the label \`sr-only\` |`

- [ ] **Step 10: Run the frontend gate**

Run: `pnpm -C frontend verify`
Expected: `ALL GATES GREEN`.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/components/ui frontend/src/providers/AppProviders.tsx frontend/src/test/renderWithProviders.tsx frontend/DESIGN.md
git commit -m "feat(frontend): AnimatedTabs, Skeleton, Toast and Tooltip ported from SmoothUI"
```

---

### Task 4: URL-state hooks

No UI change: the hooks land with tests, and `useLanguageFilter` moves onto the single owner.

**Files:**
- Create: `frontend/src/hooks/misc/{useWorkspaceParams.ts,useWorkspaceParams.test.tsx,useChangedSinceMount.ts,useChangedSinceMount.test.ts,useMediaQuery.ts,useMediaQuery.test.ts,useFocusOnRouteChange.test.tsx}`, `frontend/src/test/LocationProbe.tsx`
- Modify: `frontend/src/hooks/misc/useFocusOnRouteChange.ts`, `frontend/src/features/languages/useLanguageFilter.ts`, `frontend/src/utils/constants.ts`

**Interfaces:**
- Consumes: React Router `useSearchParams`, `useLocation`, `useNavigate`, `useNavigationType`, `NavigationType`.
- Produces:
  - `useWorkspaceParams(): WorkspaceParams` with `entryId: string | null` (empty → null), `insightsOpen: boolean` (`insights=1`), `language: string | null` (raw; `useLanguageFilter` validates it), `entryHref(id: string): string` (keeps other params, drops `insights`, `/` when empty), `selectEntry(id: string | null): void` (push), `openInsights(): void` (push with state `{ insightsOpenedInApp: true }`), `closeInsights(): void` (Back if the app opened it, else replace without `insights`), `setLanguage(code: string | null, options?: { replace?: boolean }): void`. Unrelated params (`mock`, a future `sort`) pass through.
  - `useChangedSinceMount(value: string): boolean` — false until `value` first differs from its mount value, then true forever.
  - `useMediaQuery(query: string, fallback = false): boolean` — `useSyncExternalStore` over `matchMedia`; `fallback` where `matchMedia` is missing (jsdom).
  - `DESKTOP_QUERY = '(min-width: 64rem)'` in `utils/constants.ts` (Tailwind `lg`).
  - `useFocusOnRouteChange` ignores REPLACE navigations (redirects).
  - Test helper `LocationProbe` — renders `<output aria-label="Location">{pathname + search}</output>` and a "Go back" button.

- [ ] **Step 1: Write the failing tests**

`frontend/src/test/LocationProbe.tsx`:
```tsx
import { useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'

// Exposes router state, which the workspace only changes through the URL.
export function LocationProbe() {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <output aria-label="Location">{`${pathname}${search}`}</output>
      <Button onClick={() => void navigate(-1)}>Go back</Button>
    </>
  )
}
```

`frontend/src/hooks/misc/useWorkspaceParams.test.tsx`:
```tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Button } from '@/components/ui/Button'
import { LocationProbe } from '@/test/LocationProbe'
import { renderWithProviders } from '@/test/renderWithProviders'
import { useWorkspaceParams } from './useWorkspaceParams'

function Probe() {
  const params = useWorkspaceParams()
  return (
    <>
      <output aria-label="State">{JSON.stringify({ entry: params.entryId, insights: params.insightsOpen, language: params.language })}</output>
      <output aria-label="Href">{params.entryHref('e2')}</output>
      <Button onClick={() => params.selectEntry('e1')}>select</Button>
      <Button onClick={() => params.selectEntry(null)}>new</Button>
      <Button onClick={params.openInsights}>open</Button>
      <Button onClick={params.closeInsights}>close</Button>
      <Button onClick={() => params.setLanguage('es')}>es</Button>
      <Button onClick={() => params.setLanguage(null)}>all</Button>
      <LocationProbe />
    </>
  )
}

const renderAt = (route: string) => {
  renderWithProviders(<Probe />, { route })
  return userEvent.setup()
}
const location = () => screen.getByLabelText('Location')
const button = (name: string) => screen.getByRole('button', { name })

describe('useWorkspaceParams', () => {
  it('reads the entry, the insights flag and the language from the URL', () => {
    // Arrange + Act
    renderAt('/?entry=e1&insights=1&language=fr')
    // Assert
    expect(screen.getByLabelText('State')).toHaveTextContent('{"entry":"e1","insights":true,"language":"fr"}')
  })

  it('treats an empty entry as no entry', () => {
    // Arrange + Act
    renderAt('/?entry=')
    // Assert
    expect(screen.getByLabelText('State')).toHaveTextContent('"entry":null')
  })

  it('selects and clears an entry without touching other params', async () => {
    // Arrange
    const user = renderAt('/?language=fr&mock=slow')
    // Act + Assert
    await user.click(button('select'))
    expect(location()).toHaveTextContent('/?language=fr&mock=slow&entry=e1')
    await user.click(button('new'))
    expect(location()).toHaveTextContent(/^\/\?language=fr&mock=slow$/)
  })

  it('links to an entry with the filter kept and insights closed', () => {
    // Arrange + Act
    renderAt('/?language=fr&insights=1')
    // Assert
    expect(screen.getByLabelText('Href')).toHaveTextContent('/?language=fr&entry=e2')
  })

  it('closes insights it opened by going Back, so history holds no duplicate', async () => {
    // Arrange
    const user = renderAt('/?language=fr')
    await user.click(button('open'))
    expect(location()).toHaveTextContent('/?language=fr&insights=1')
    // Act
    await user.click(button('close'))
    // Assert
    expect(location()).toHaveTextContent(/^\/\?language=fr$/)
    await user.click(button('Go back'))
    expect(location()).not.toHaveTextContent('insights')
  })

  it('closes deep-linked insights by replacing the URL, so closing never leaves the app', async () => {
    // Arrange
    const user = renderAt('/?insights=1&language=fr')
    // Act
    await user.click(button('close'))
    // Assert
    expect(location()).toHaveTextContent(/^\/\?language=fr$/)
  })

  it('sets and clears the language', async () => {
    // Arrange
    const user = renderAt('/?entry=e1')
    // Act + Assert
    await user.click(button('es'))
    expect(location()).toHaveTextContent('/?entry=e1&language=es')
    await user.click(button('all'))
    expect(location()).toHaveTextContent(/^\/\?entry=e1$/)
  })
})
```

`frontend/src/hooks/misc/useChangedSinceMount.test.ts`:
```ts
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useChangedSinceMount } from './useChangedSinceMount'

describe('useChangedSinceMount', () => {
  it('is false on mount and while the value stays the same', () => {
    // Arrange
    const { result, rerender } = renderHook(({ value }) => useChangedSinceMount(value), { initialProps: { value: 'a' } })
    // Act
    rerender({ value: 'a' })
    // Assert
    expect(result.current).toBe(false)
  })

  it('turns true on the first change and stays true even if the value comes back', () => {
    // Arrange
    const { result, rerender } = renderHook(({ value }) => useChangedSinceMount(value), { initialProps: { value: 'a' } })
    // Act
    rerender({ value: 'b' })
    const afterChange = result.current
    rerender({ value: 'a' })
    // Assert
    expect(afterChange).toBe(true)
    expect(result.current).toBe(true)
  })
})
```

`frontend/src/hooks/misc/useMediaQuery.test.ts`:
```ts
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMediaQuery } from './useMediaQuery'

function fakeMatchMedia(initial: boolean) {
  let matches = initial
  const listeners = new Set<() => void>()
  const list = {
    get matches() {
      return matches
    },
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  }
  vi.stubGlobal('matchMedia', () => list)
  return (next: boolean) => {
    matches = next
    for (const listener of listeners) listener()
  }
}

describe('useMediaQuery', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('answers the fallback where matchMedia does not exist', () => {
    // Arrange + Act
    const { result } = renderHook(() => useMediaQuery('(min-width: 64rem)', true))
    // Assert
    expect(result.current).toBe(true)
  })

  it('follows the media query as it changes', () => {
    // Arrange
    const change = fakeMatchMedia(false)
    const { result } = renderHook(() => useMediaQuery('(min-width: 64rem)', true))
    expect(result.current).toBe(false)
    // Act
    act(() => change(true))
    // Assert
    expect(result.current).toBe(true)
  })
})
```

`frontend/src/hooks/misc/useFocusOnRouteChange.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Navigate, Outlet, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { TextLink } from '@/components/ui/TextLink'
import { useFocusOnRouteChange } from './useFocusOnRouteChange'

// A layout route, like AppShell: one hook instance sees every pathname change, including a redirect's.
function Layout() {
  useFocusOnRouteChange()
  return (
    <main>
      <Outlet />
      <TextLink to="/other">Other</TextLink>
    </main>
  )
}

function renderAt(route: string) {
  render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<h1 tabIndex={-1}>Home</h1>} />
          <Route path="/other" element={<h1 tabIndex={-1}>Other page</h1>} />
          <Route path="/old" element={<Navigate replace to="/" />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('useFocusOnRouteChange', () => {
  it('moves focus to the new heading when the user goes to another path', async () => {
    // Arrange
    const user = userEvent.setup()
    renderAt('/')
    // Act
    await user.click(screen.getByRole('link', { name: 'Other' }))
    // Assert
    expect(screen.getByRole('heading', { name: 'Other page' })).toHaveFocus()
  })

  it('leaves focus alone when a redirect replaces the path', async () => {
    // Arrange + Act
    renderAt('/old')
    // Assert
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument()
    expect(document.body).toHaveFocus()
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm -C frontend exec vitest run src/hooks/misc`
Expected: FAIL — `useWorkspaceParams`, `useChangedSinceMount`, `useMediaQuery` not found; the redirect focus test fails.

- [ ] **Step 3: Implement the hooks**

`frontend/src/utils/constants.ts` — append:
```ts
// Tailwind's `lg`: the sidebar sits beside the main column from here up, and becomes a sheet below it.
export const DESKTOP_QUERY = '(min-width: 64rem)'
```

`frontend/src/hooks/misc/useWorkspaceParams.ts`:
```ts
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
```

`frontend/src/hooks/misc/useChangedSinceMount.ts`:
```ts
import { useState } from 'react'

// Tells a deep link (leave focus alone) from the user moving around (focus what changed). Remembered in state, so
// going back to the first value still counts as "moved".
export function useChangedSinceMount(value: string): boolean {
  const [initial] = useState(value)
  const [changed, setChanged] = useState(false)
  const differs = value !== initial
  if (differs && !changed) setChanged(true)
  return changed || differs
}
```

`frontend/src/hooks/misc/useMediaQuery.ts`:
```ts
import { useCallback, useSyncExternalStore } from 'react'

const supported = () => typeof window.matchMedia === 'function'

// `fallback` answers where matchMedia does not exist (jsdom), so component tests get the layout they exercise most.
export function useMediaQuery(query: string, fallback = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!supported()) return () => undefined
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )
  const snapshot = () => (supported() ? window.matchMedia(query).matches : fallback)
  return useSyncExternalStore(subscribe, snapshot, () => fallback)
}
```

`frontend/src/hooks/misc/useFocusOnRouteChange.ts`:
```ts
import { useEffect, useRef } from 'react'
import { NavigationType, useLocation, useNavigationType } from 'react-router'

// SPA navigation keeps focus on the clicked link; moving it to the new page's heading tells screen-reader users the page changed.
// Pathname only: a filter change on the same page must not pull focus away from the control being used.
// A redirect (REPLACE) is not the user going anywhere: an old link landing in the workspace must not grab focus.
export function useFocusOnRouteChange(): void {
  const { pathname } = useLocation()
  const navigationType = useNavigationType()
  const previous = useRef(pathname)
  useEffect(() => {
    if (previous.current === pathname) return
    previous.current = pathname
    if (navigationType !== NavigationType.Replace) document.querySelector<HTMLElement>('main h1')?.focus()
  }, [pathname, navigationType])
}
```

`frontend/src/features/languages/useLanguageFilter.ts`:
```ts
import { useEffect } from 'react'
import { useWorkspaceParams } from '@/hooks/misc/useWorkspaceParams'
import { useLanguagesQuery } from '@/hooks/queries/useLanguagesQuery'

type LanguageFilterState = 'pending' | 'failed' | 'ready'

function stateOf(failed: boolean, settled: boolean): LanguageFilterState {
  if (failed) return 'failed'
  return settled ? 'ready' : 'pending'
}

// The filter lives in the URL (one owner: useWorkspaceParams) so Back and shared links keep it; a code the server
// does not offer is not a filter.
export function useLanguageFilter() {
  const { language: requested, setLanguage } = useWorkspaceParams()
  const languages = useLanguagesQuery()
  const known = languages.data?.some((language) => language.code === requested) ?? false
  const staleParam = languages.isSuccess && requested !== null && !known

  useEffect(() => {
    if (staleParam) setLanguage(null, { replace: true })
  }, [staleParam, setLanguage])

  return {
    language: known ? requested : null,
    // "ready" waits for the language list, so an unknown code never reaches the API.
    state: stateOf(languages.isError, languages.isSuccess && !staleParam),
    changeLanguage: (code: string) => setLanguage(code),
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm -C frontend exec vitest run src/hooks src/features/languages src/features/history src/features/insights`
Expected: PASS — including the unchanged `useLanguageFilter` and History/Insights filter tests (same URLs as before).

- [ ] **Step 5: Run the frontend gate**

Run: `pnpm -C frontend verify`
Expected: `ALL GATES GREEN`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/hooks/misc frontend/src/features/languages/useLanguageFilter.ts frontend/src/utils/constants.ts frontend/src/test/LocationProbe.tsx
git commit -m "feat(frontend): one URL owner for workspace state; redirects keep focus"
```

---
### Task 5: The workspace flip — layout, sidebar, main column, redirects

`/` becomes the workspace. History and Entry detail stop being pages: the history list is the sidebar, the entry detail is the main column. Insights stays at `/insights` for one more task (a page with a "Back to your journal" link) and becomes a sheet in Task 6. Below `lg` the sidebar stacks above the main column until Task 8 moves it into a sheet.

**Files:**
- Create: `frontend/src/features/workspace/{Workspace.tsx,WorkspaceHeader.tsx,Sidebar.tsx,MainColumn.tsx,Composer.tsx,Workspace.test.tsx}`, `frontend/src/pages/{WorkspacePage.tsx,LegacyRedirects.tsx}`, `frontend/e2e/workspace.ts`
- Modify: `frontend/src/AppRoutes.tsx`, `frontend/src/AppRoutes.test.tsx`, `frontend/src/features/shell/AppShell.tsx`, `frontend/src/pages/{NotFoundPage.tsx,InsightsPage.tsx}`, `frontend/src/features/write/WriteScreen.tsx`, `frontend/src/features/entry-detail/{EntryDetail.tsx,EntryHeader.tsx,EntryNotFound.tsx,EntryDetail.test.tsx}`, `frontend/src/features/history/{HistoryList.tsx,FilteredHistory.tsx,HistoryResults.tsx,EntryRow.tsx,EntryRow.test.tsx,HistoryList.test.tsx,HistoryList.filter.test.tsx}`, `frontend/src/features/languages/LanguageFiltered.tsx`, `frontend/src/features/insights/{InsightsScreen.tsx,InsightsScreen.test.tsx}`, `frontend/src/test/helpers.ts`, `frontend/e2e/{smoke,history,write,insights}.spec.ts`
- Delete: `frontend/src/pages/{WritePage.tsx,HistoryPage.tsx,EntryDetailPage.tsx}`

**Interfaces:**
- Consumes: `useWorkspaceParams`, `useChangedSinceMount` (Task 4), `PageHeading` `ref` (Task 1), `Button`, `Icon`.
- Produces:
  - Routes: `/` → `WorkspacePage`; `/entries` → `/` and `/entries/:entryId` → `/?entry=:entryId` (`Navigate replace`, query kept); `/insights` → `InsightsPage` (until Task 6); `*` → `NotFoundPage`.
  - `Workspace()` layout: `WorkspaceHeader` · `<aside aria-label="Your entries">` with `Sidebar` · `<main id="main">` with `MainColumn`.
  - `Sidebar({ onNewEntry: () => void })` (Task 6 adds `onOpenInsights`).
  - `MainColumn({ entryId: string | null, composerKey: number, moved: boolean })` — `EntryDetail` keyed by id (focuses its heading when `moved`) or `Composer` keyed by `composerKey` (focuses the editor when `moved`).
  - `WriteScreen({ autoFocus?: boolean })`, `EntryDetail({ entryId, focusHeading?: boolean })`.
  - `HistoryList({ onStartWriting: () => void })` → `FilteredHistory({ language, onStartWriting })` → `HistoryResults({ entries, filtered, onStartWriting })`; the empty state's action is a "Write your first entry" button.
  - `EntryRow` links to `entryHref(entry.id)` and sets `aria-current="true"` on the open entry.
  - Both list filters are labelled "Filter by language"; their ids come from `useId`.
  - e2e helpers `openEntries(page): Promise<Locator>`, `mainColumn(page)`, `composerLanguage(page)`.

Design choice: the composer unmounts while an entry is open (conditional render, not a hidden copy). The draft text and language already live in `localStorage` (`useDraft`), so peeking at an old entry never loses typing; a hidden composer would keep a second `h1`, a second set of document-level Esc listeners and stale focus targets in the DOM.

- [ ] **Step 1: Write the failing tests**

`frontend/src/features/workspace/Workspace.test.tsx`:
```tsx
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { SEEDED } from '@/mocks/seed'
import { waitForLanguages } from '@/test/helpers'
import { LocationProbe } from '@/test/LocationProbe'
import { renderWithProviders } from '@/test/renderWithProviders'
import { Workspace } from './Workspace'

const MISSING = 'ffffffff-ffff-4fff-8fff-ffffffffffff'

function renderWorkspace(route = '/') {
  renderWithProviders(
    <>
      <Workspace />
      <LocationProbe />
    </>,
    { route },
  )
  return userEvent.setup()
}

const sidebar = () => screen.getByRole('complementary', { name: 'Your entries' })
const main = () => screen.getByRole('main')
const location = () => screen.getByLabelText('Location')
const marketRow = () => within(sidebar()).findByRole('link', { name: /Je suis allé au marché/ })

describe('Workspace', () => {
  it('opens an entry from the sidebar in place, marks its row and focuses its heading', async () => {
    // Arrange
    const user = renderWorkspace()
    // Act
    await user.click(await marketRow())
    // Assert
    expect(await within(main()).findByRole('heading', { level: 1, name: 'Entry' })).toHaveFocus()
    expect(await marketRow()).toHaveAttribute('aria-current', 'true')
    expect(location()).toHaveTextContent(`/?entry=${SEEDED.revisedFrench}`)
    expect(within(main()).queryByLabelText('Your entry')).not.toBeInTheDocument()
  })

  it('starts a new entry from the sidebar: selection cleared, editor focused', async () => {
    // Arrange
    const user = renderWorkspace(`/?entry=${SEEDED.emoji}`)
    await within(main()).findByRole('heading', { level: 1, name: 'Entry' })
    // Act
    await user.click(within(sidebar()).getByRole('button', { name: 'New entry' }))
    // Assert
    expect(within(main()).getByLabelText('Your entry')).toHaveFocus()
    expect(location()).toHaveTextContent(/^\/$/)
  })

  it('keeps the draft when the learner peeks at an old entry and comes back', async () => {
    // Arrange
    const user = renderWorkspace()
    await waitForLanguages()
    await user.type(within(main()).getByLabelText('Your entry'), 'Hola amigos')
    await user.click(await marketRow())
    await within(main()).findByRole('heading', { level: 1, name: 'Entry' })
    // Act
    await user.click(screen.getByRole('button', { name: 'Go back' }))
    // Assert
    expect(await within(main()).findByLabelText('Your entry')).toHaveValue('Hola amigos')
  })

  it('leaves focus alone when a deep link opens an entry', async () => {
    // Arrange + Act
    renderWorkspace(`/?entry=${SEEDED.emoji}`)
    // Assert
    expect(await within(main()).findByRole('heading', { level: 2, name: 'Feedback' })).toBeInTheDocument()
    expect(document.body).toHaveFocus()
  })

  it('explains a missing entry in the main column and keeps the sidebar usable', async () => {
    // Arrange + Act
    renderWorkspace(`/?entry=${MISSING}`)
    // Assert
    expect(await within(main()).findByRole('heading', { level: 1, name: 'Entry not found' })).toBeInTheDocument()
    expect(within(main()).getByRole('link', { name: 'Write a new entry' })).toHaveAttribute('href', '/')
    expect(await marketRow()).toBeInTheDocument()
  })

  it('treats a mangled entry id as not found rather than an error to retry', async () => {
    // Arrange + Act
    renderWorkspace('/?entry=not-an-id')
    // Assert
    expect(await within(main()).findByRole('heading', { level: 1, name: 'Entry not found' })).toBeInTheDocument()
    expect(within(main()).queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })
})
```

`frontend/src/AppRoutes.test.tsx` (whole file):
```tsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { SEEDED } from '@/mocks/seed'
import { LocationProbe } from '@/test/LocationProbe'
import { renderWithProviders } from '@/test/renderWithProviders'
import { AppRoutes } from './AppRoutes'

const renderAt = (route: string) =>
  renderWithProviders(
    <>
      <AppRoutes />
      <LocationProbe />
    </>,
    { route },
  )
const location = () => screen.getByLabelText('Location')

describe('routes', () => {
  it('opens the workspace at the root: brand, composer and entries', async () => {
    // Arrange + Act
    renderAt('/')
    // Assert
    expect(screen.getByRole('link', { name: 'Language Journal' })).toHaveAttribute('href', '/')
    expect(within(screen.getByRole('main')).getByRole('heading', { level: 1, name: 'Write' })).toBeInTheDocument()
    expect(await screen.findByRole('list', { name: 'Entries' })).toBeInTheDocument()
  })

  it.each([
    ['/entries', '/'],
    ['/entries?language=fr', '/?language=fr'],
    [`/entries/${SEEDED.emoji}`, `/?entry=${SEEDED.emoji}`],
    [`/entries/${SEEDED.emoji}?language=es`, `/?language=es&entry=${SEEDED.emoji}`],
  ])('redirects the old link %s into the workspace at %s', async (route, target) => {
    // Arrange + Act
    renderAt(route)
    // Assert
    await waitFor(() => expect(location()).toHaveTextContent(target))
    expect(location().textContent).toBe(target)
  })

  it('leaves focus alone on first load, even through a redirect', async () => {
    // Arrange + Act
    renderAt(`/entries/${SEEDED.emoji}`)
    // Assert
    expect(await screen.findByRole('heading', { level: 1, name: 'Entry' })).toBeInTheDocument()
    expect(document.body).toHaveFocus()
  })

  it('shows a not-found page with a way back for unknown paths', () => {
    // Arrange + Act
    renderAt('/nowhere')
    // Assert
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to writing' })).toHaveAttribute('href', '/')
  })

  it('moves focus to the workspace heading when coming back from a missing page', async () => {
    // Arrange
    const user = userEvent.setup()
    renderAt('/nowhere')
    // Act
    await user.click(screen.getByRole('link', { name: 'Back to writing' }))
    // Assert
    expect(await screen.findByRole('heading', { level: 1, name: 'Write' })).toHaveFocus()
  })

  it.each(['/', '/nowhere'])('offers a skip link to the main content on %s', (route) => {
    // Arrange + Act
    renderAt(route)
    // Assert
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main')
  })

  it('does not steal focus when only the filter changes', async () => {
    // Arrange
    const user = userEvent.setup()
    renderAt('/')
    const filter = await screen.findByLabelText('Filter by language')
    await within(filter).findByRole('option', { name: 'Spanish' })
    // Act
    await user.selectOptions(filter, 'es')
    // Assert
    expect(filter).toHaveFocus()
  })

  it.each([
    ['/', 'Write · Language Journal'],
    [`/?entry=${SEEDED.emoji}`, 'Entry · Language Journal'],
    ['/insights', 'Insights · Language Journal'],
    ['/nowhere', 'Page not found · Language Journal'],
  ])('titles the document for %s', async (route, title) => {
    // Arrange + Act
    renderAt(route)
    // Assert
    await waitFor(() => expect(document.title).toBe(title))
  })
})
```

Edits to existing tests (same behaviour, new seams):
- `src/test/helpers.ts` — two selects now list languages on one screen:
  ```ts
  export async function waitForLanguages(): Promise<void> {
    await screen.findAllByRole('option', { name: 'Spanish' })
  }
  ```
- `HistoryList.test.tsx`: `const renderHistory = (onStartWriting = vi.fn()) => renderWithProviders(<HistoryList onStartWriting={onStartWriting} />, { route: '/' })` (add `vi` to the vitest import); `getByLabelText('Language')` → `getByLabelText('Filter by language')`; replace the empty-state test body with:
  ```tsx
    // Arrange
    setMockMode('empty')
    const onStartWriting = vi.fn()
    const user = userEvent.setup()
    renderHistory(onStartWriting)
    // Act
    await user.click(await screen.findByRole('button', { name: 'Write your first entry' }))
    // Assert
    expect(screen.getByText('No entries yet')).toBeInTheDocument()
    expect(onStartWriting).toHaveBeenCalledTimes(1)
  ```
  and rename it `'shows an empty state whose action starts a new entry'`.
- `HistoryList.filter.test.tsx`: `<HistoryList onStartWriting={vi.fn()} />` in `renderAt`; every `getByLabelText('Language')` → `getByLabelText('Filter by language')`; routes `/entries…` → `/…` (e.g. `renderAt('/?language=fr')`, `` renderAt(`/${query}`) ``).
- `EntryRow.test.tsx`: `renderWithProviders(<HistoryList onStartWriting={vi.fn()} />, { route })` with a `route = '/'` parameter on `renderRows`; the href assertion becomes `` toHaveAttribute('href', `/?entry=${SEEDED.emoji}`) ``; add
  ```tsx
  it('mark the open entry as the current one', async () => {
    // Arrange + Act
    await renderRows(`/?entry=${SEEDED.emoji}`)
    // Assert
    expect(within(rowContaining('Hoy 😀 la problema')).getByRole('link')).toHaveAttribute('aria-current', 'true')
    expect(within(rowContaining('Escribo esto antes de dormir')).getByRole('link')).not.toHaveAttribute('aria-current')
  })
  ```
- `EntryDetail.test.tsx`: the "offers the way back to History" table becomes `'offers a new entry, not a retry, for %s'` asserting `` expect(await screen.findByRole('link', { name: 'Write a new entry' })).toHaveAttribute('href', '/') ``.
- `InsightsScreen.test.tsx`: `getByLabelText('Language')` → `getByLabelText('Filter by language')`.

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm -C frontend exec vitest run src/AppRoutes.test.tsx src/features`
Expected: FAIL — `./Workspace` not found; redirects and the "Filter by language" label do not exist; History rows still link to `/entries/:id`.

- [ ] **Step 3: Routes, shell and pages**

`frontend/src/AppRoutes.tsx`:
```tsx
import { Route, Routes } from 'react-router'
import { AppShell } from '@/features/shell/AppShell'
import { InsightsPage } from '@/pages/InsightsPage'
import { EntriesRedirect, EntryRedirect } from '@/pages/LegacyRedirects'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { WorkspacePage } from '@/pages/WorkspacePage'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<WorkspacePage />} />
        <Route path="entries" element={<EntriesRedirect />} />
        <Route path="entries/:entryId" element={<EntryRedirect />} />
        <Route path="insights" element={<InsightsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
```

`frontend/src/pages/LegacyRedirects.tsx`:
```tsx
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
```

`frontend/src/pages/WorkspacePage.tsx`:
```tsx
import { Workspace } from '@/features/workspace/Workspace'

export function WorkspacePage() {
  return <Workspace />
}
```

`frontend/src/features/shell/AppShell.tsx`:
```tsx
import { Outlet } from 'react-router'
import { useFocusOnRouteChange } from '@/hooks/misc/useFocusOnRouteChange'

const skipLinkClass =
  'sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-toast focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-contrast'

// Each screen owns its <main id="main">: the workspace's main column sits beside a sidebar that is not main content.
export function AppShell() {
  useFocusOnRouteChange()
  return (
    <div className="min-h-screen bg-bg text-fg antialiased">
      <a href="#main" className={skipLinkClass}>
        Skip to content
      </a>
      <Outlet />
    </div>
  )
}
```

`frontend/src/pages/NotFoundPage.tsx`:
```tsx
import { PageHeading } from '@/components/ui/PageHeading'
import { TextLink } from '@/components/ui/TextLink'

export function NotFoundPage() {
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex max-w-main flex-col items-start gap-4 px-4 py-12">
      <title>Page not found · Language Journal</title>
      <PageHeading>Page not found</PageHeading>
      <p className="text-muted">That page does not exist.</p>
      <TextLink to="/">Back to writing</TextLink>
    </main>
  )
}
```

`frontend/src/pages/InsightsPage.tsx` (temporary until Task 6):
```tsx
import { PageHeading } from '@/components/ui/PageHeading'
import { TextLink } from '@/components/ui/TextLink'
import { InsightsScreen } from '@/features/insights/InsightsScreen'

export function InsightsPage() {
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex max-w-content flex-col gap-6 px-4 py-6">
      <title>Insights · Language Journal</title>
      <TextLink to="/">Back to your journal</TextLink>
      <div className="flex flex-col gap-1">
        <PageHeading>Insights</PageHeading>
        <p className="text-muted">How your errors change as you write. Suggestions and word help don’t count.</p>
      </div>
      <InsightsScreen />
    </main>
  )
}
```

Delete the old pages:
```bash
git rm frontend/src/pages/WritePage.tsx frontend/src/pages/HistoryPage.tsx frontend/src/pages/EntryDetailPage.tsx
```

- [ ] **Step 4: The workspace**

`frontend/src/features/workspace/Workspace.tsx`:
```tsx
import { useState } from 'react'
import { useChangedSinceMount } from '@/hooks/misc/useChangedSinceMount'
import { useWorkspaceParams } from '@/hooks/misc/useWorkspaceParams'
import { MainColumn } from './MainColumn'
import { Sidebar } from './Sidebar'
import { WorkspaceHeader } from './WorkspaceHeader'

export function Workspace() {
  const { entryId, selectEntry } = useWorkspaceParams()
  // Bumped by "New entry" so a finished session starts over even when no entry was selected.
  const [composerKey, setComposerKey] = useState(0)
  // False on first load, so a deep link never steals focus; true once the learner moves within the workspace.
  const moved = useChangedSinceMount(`${entryId ?? ''}|${composerKey}`)
  const startNewEntry = () => {
    selectEntry(null)
    setComposerKey((key) => key + 1)
  }
  return (
    <div className="flex min-h-screen flex-col">
      <WorkspaceHeader />
      <div className="mx-auto flex w-full max-w-content flex-1 flex-col gap-6 px-4 lg:flex-row lg:gap-8 lg:px-6">
        <aside aria-label="Your entries" className="pt-6 lg:w-sidebar lg:shrink-0 lg:border-r lg:border-border lg:pr-6 lg:pb-6">
          <Sidebar onNewEntry={startNewEntry} />
        </aside>
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 py-6">
          <div className="mx-auto flex max-w-main flex-col gap-6">
            <MainColumn entryId={entryId} composerKey={composerKey} moved={moved} />
          </div>
        </main>
      </div>
    </div>
  )
}
```

`frontend/src/features/workspace/WorkspaceHeader.tsx`:
```tsx
import { Link } from 'react-router'
import { TextLink } from '@/components/ui/TextLink'

// The gradient band lives here only (DESIGN.md): it marks the frame, never the writing.
export function WorkspaceHeader() {
  return (
    <header className="border-b border-border bg-linear-to-b from-band to-bg">
      <div className="mx-auto flex max-w-content items-center gap-3 px-4 py-3 lg:px-6">
        <Link to="/" className="text-lg font-light tracking-tight text-fg">
          Language Journal
        </Link>
        <TextLink to="/insights" className="ml-auto text-sm">
          Insights
        </TextLink>
      </div>
    </header>
  )
}
```

`frontend/src/features/workspace/Sidebar.tsx`:
```tsx
import { useId } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { HistoryList } from '@/features/history/HistoryList'

export interface SidebarProps {
  onNewEntry: () => void
}

export function Sidebar({ onNewEntry }: SidebarProps) {
  const historyId = useId()
  return (
    <div className="flex flex-col gap-6">
      <Button variant="primary" onClick={onNewEntry}>
        <Icon name="plus" />
        New entry
      </Button>
      <section aria-labelledby={historyId} className="flex flex-col gap-3">
        <h2 id={historyId} className="text-sm font-medium text-fg-secondary">
          History
        </h2>
        <HistoryList onStartWriting={onNewEntry} />
      </section>
    </div>
  )
}
```

`frontend/src/features/workspace/MainColumn.tsx`:
```tsx
import { EntryDetail } from '@/features/entry-detail/EntryDetail'
import { Composer } from './Composer'

export interface MainColumnProps {
  entryId: string | null
  composerKey: number
  moved: boolean
}

// The composer unmounts while an entry is open; its draft lives in localStorage (useDraft), so nothing typed is lost.
export function MainColumn({ entryId, composerKey, moved }: MainColumnProps) {
  if (entryId) return <EntryDetail key={entryId} entryId={entryId} focusHeading={moved} />
  return <Composer key={composerKey} autoFocus={moved} />
}
```

`frontend/src/features/workspace/Composer.tsx`:
```tsx
import { PageHeading } from '@/components/ui/PageHeading'
import { WriteScreen } from '@/features/write/WriteScreen'

export function Composer({ autoFocus }: { autoFocus: boolean }) {
  return (
    <>
      <title>Write · Language Journal</title>
      <div className="flex flex-col gap-1">
        <PageHeading>Write</PageHeading>
        <p className="text-muted">Write freely in the language you are learning, then get feedback.</p>
      </div>
      <WriteScreen autoFocus={autoFocus} />
    </>
  )
}
```

`frontend/src/features/write/WriteScreen.tsx` — accept the prop:
```tsx
export interface WriteScreenProps {
  // True when the learner navigated here (New entry, Back): the editor takes focus. Never on first load.
  autoFocus?: boolean
}

export function WriteScreen({ autoFocus = false }: WriteScreenProps) {
  const draft = useDraft()
  const session = useWriteSession(draft.clearText)
  // False on first load so the page never steals focus; true after "New entry".
  const [focusEditor, setFocusEditor] = useState(autoFocus)
  …rest unchanged…
```

- [ ] **Step 5: Entry detail in the main column**

`frontend/src/features/entry-detail/EntryDetail.tsx` — props and heading:
```tsx
export interface EntryDetailProps {
  entryId: string
  // True when the learner picked this entry (not a deep link): its heading takes focus.
  focusHeading?: boolean
}
…
export function EntryDetail({ entryId, focusHeading = false }: EntryDetailProps) {
  const entry = useEntryQuery(entryId)
  const analyses = useAnalysesQuery(entryId)
  const headingRef = useFocusOnMount<HTMLHeadingElement>()
  const missing = entry.isError && !entry.data && isMissing(entry.error)
  const title = missing ? 'Entry not found' : 'Entry'
  // One heading element in every state: focus moved to it on selection, and swapping it would drop that focus.
  return (
    <div className="flex flex-col gap-6">
      <title>{`${title} · Language Journal`}</title>
      <PageHeading ref={focusHeading ? headingRef : undefined}>{title}</PageHeading>
      {missing ? <EntryNotFound /> : <EntryDetailBody entry={entry} analyses={analyses} />}
    </div>
  )
}
```
(add `import { useFocusOnMount } from '@/hooks/misc/useFocusOnMount'`).

`frontend/src/features/entry-detail/EntryHeader.tsx` — the sidebar replaces "Back to history":
```tsx
import { useLanguageName } from '@/features/languages/useLanguageName'
import type { EntryOut } from '@/types/entry'
import { formatDateTime, pluralize } from '@/utils/formatter'

export interface EntryHeaderProps {
  entry: EntryOut
}

export function EntryHeader({ entry }: EntryHeaderProps) {
  const languageName = useLanguageName(entry.language)
  return (
    <p className="text-sm text-muted">
      {languageName} · {formatDateTime(entry.created_at)} · {pluralize(entry.word_count, 'word')}
    </p>
  )
}
```

`frontend/src/features/entry-detail/EntryNotFound.tsx`:
```tsx
import { EmptyState } from '@/components/ui/EmptyState'
import { TextLink } from '@/components/ui/TextLink'

export function EntryNotFound() {
  return (
    <EmptyState title="We couldn't find that entry. It may have been removed.">
      <TextLink to="/">Write a new entry</TextLink>
    </EmptyState>
  )
}
```

- [ ] **Step 6: History becomes the sidebar list**

`frontend/src/features/languages/LanguageFiltered.tsx` — the label:
```tsx
        <LanguageSelect id={id} label="Filter by language" value={filter.language ?? ''} onChange={filter.changeLanguage} allLabel="All languages" />
```

`frontend/src/features/history/HistoryList.tsx`:
```tsx
import { useId } from 'react'
import { LanguageFiltered } from '@/features/languages/LanguageFiltered'
import { FilteredHistory } from './FilteredHistory'

export interface HistoryListProps {
  onStartWriting: () => void
}

export function HistoryList({ onStartWriting }: HistoryListProps) {
  const id = useId()
  return (
    <LanguageFiltered id={id} loadingLabel="Loading entries…">
      {(language) => <FilteredHistory language={language} onStartWriting={onStartWriting} />}
    </LanguageFiltered>
  )
}
```

`frontend/src/features/insights/InsightsScreen.tsx` — same `useId` change (`const id = useId()`, `id={id}`).

`frontend/src/features/history/FilteredHistory.tsx`:
```tsx
import { useEntriesQuery } from '@/hooks/queries/useEntriesQuery'
import { HistoryResults } from './HistoryResults'

export interface FilteredHistoryProps {
  language: string | null
  onStartWriting: () => void
}

export function FilteredHistory({ language, onStartWriting }: FilteredHistoryProps) {
  const entries = useEntriesQuery(language)
  return <HistoryResults entries={entries} filtered={language !== null} onStartWriting={onStartWriting} />
}
```

`frontend/src/features/history/HistoryResults.tsx` — props, empty action and the compact list:
```tsx
export interface HistoryResultsProps {
  entries: ReturnType<typeof useEntriesQuery>
  filtered: boolean
  onStartWriting: () => void
}

export function HistoryResults({ entries, filtered, onStartWriting }: HistoryResultsProps) {
  …unchanged loading and error branches…
  if (items.length === 0) {
    return (
      <EmptyState title={filtered ? 'No entries in this language yet' : 'No entries yet'}>
        <Button onClick={onStartWriting}>Write your first entry</Button>
      </EmptyState>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <ul ref={listRef} aria-label="Entries" className="-mx-3 flex flex-col gap-1">
        {items.map((entry) => (
          <EntryRow key={entry.id} entry={entry} />
        ))}
      </ul>
      <p role="status" className="text-xs text-muted">
        Showing {pluralize(items.length, 'entry', 'entries')}
      </p>
      …unchanged LoadMore…
    </div>
  )
}
```
(replace the `TextLink` import with `import { Button } from '@/components/ui/Button'`).

`frontend/src/features/history/EntryRow.tsx` — the link and its layout:
```tsx
import { useWorkspaceParams } from '@/hooks/misc/useWorkspaceParams'
…
const linkClass = 'flex min-w-0 flex-col gap-1 rounded-md px-3 py-2 hover:bg-surface aria-[current=true]:bg-primary-soft'

export function EntryRow({ entry }: EntryRowProps) {
  const languageName = useLanguageName(entry.language)
  const { entryId, entryHref } = useWorkspaceParams()
  const analyze = useRunAnalysisMutation()
  const linkRef = useRef<HTMLAnchorElement>(null)
  const retried = analyze.data?.status
  // The retry button is gone once the analysis succeeds, so focus would otherwise fall back to the page body.
  useEffect(() => {
    if (retried === 'succeeded') linkRef.current?.focus()
  }, [retried])
  return (
    <li className="flex flex-col gap-1">
      <Link ref={linkRef} to={entryHref(entry.id)} aria-current={entry.id === entryId ? 'true' : undefined} className={linkClass}>
        <span className="line-clamp-2 text-sm text-fg">{entry.preview}</span>
        <span className="flex flex-wrap items-center justify-between gap-2 text-xs text-fg-secondary">
          <span>
            {formatDateTime(entry.created_at)} · {languageName}
          </span>
          <EntryStatus entry={entry} />
        </span>
      </Link>
      {entry.latest_status !== 'succeeded' && (
        <div className="flex flex-col items-start gap-1 px-3">
          <RetryAnalysisButton
            label={entry.latest_status === null ? 'Get feedback' : 'Retry analysis'}
            preview={entry.preview}
            pending={analyze.isPending}
            error={analyze.error}
            onRetry={() => analyze.mutate(entry.id)}
          />
        </div>
      )}
      <p role="status" className="sr-only">
        {analyze.isPending || !retried ? '' : OUTCOME_MESSAGE[retried]}
      </p>
    </li>
  )
}
```

- [ ] **Step 7: Run the unit tests**

Run: `pnpm -C frontend exec vitest run`
Expected: PASS.

- [ ] **Step 8: Update the e2e journeys**

`frontend/e2e/workspace.ts`:
```ts
import type { Locator, Page } from '@playwright/test'

/** The entries sidebar (the left column). Task 8 turns it into a sheet on phones; specs already go through here. */
export async function openEntries(page: Page): Promise<Locator> {
  return page.getByRole('complementary', { name: 'Your entries' })
}

export const mainColumn = (page: Page): Locator => page.getByRole('main')

/** "Filter by language" also contains "Language", so the composer's select needs an exact match. */
export const composerLanguage = (page: Page): Locator => page.getByLabel('Language', { exact: true })
```

`frontend/e2e/smoke.spec.ts`:
```ts
import { expect, test } from '@playwright/test'
import { expectNoA11yViolations } from './a11y'
import { expectButtonsShowPointer } from './cursor'
import { mainColumn, openEntries } from './workspace'

test('the workspace loads with the brand, the composer and the entries, with no a11y violations', async ({ page }) => {
  // Arrange
  await page.goto('/')
  // Act
  const entries = await openEntries(page)
  // Assert
  await expect(page.getByRole('link', { name: 'Language Journal' })).toBeVisible()
  await expect(mainColumn(page).getByRole('heading', { level: 1 })).toHaveText('Write')
  await expect(page).toHaveTitle('Write · Language Journal')
  await expect(entries.getByRole('list', { name: 'Entries' }).getByRole('listitem')).toHaveCount(10)
  await expectNoA11yViolations(page)
  await expectButtonsShowPointer(page)
})

test('a link from before the workspace opens that entry in it', async ({ page }) => {
  // Arrange
  const id = '00000000-0000-4000-8000-000000000002'
  // Act
  await page.goto(`/entries/${id}?language=es`)
  // Assert
  await expect(page).toHaveURL(`/?language=es&entry=${id}`)
  await expect(mainColumn(page).getByRole('heading', { level: 1, name: 'Entry' })).toBeVisible()
})

test('unknown paths show a not-found page with a way back', async ({ page }) => {
  // Arrange
  await page.goto('/nowhere')
  // Act
  await page.getByRole('link', { name: 'Back to writing' }).click()
  // Assert
  await expect(page).toHaveURL('/')
  await expect(mainColumn(page).getByRole('heading', { level: 1 })).toHaveText('Write')
})
```

`frontend/e2e/history.spec.ts`:
```ts
import { expect, test, type Page } from '@playwright/test'
import { expectNoA11yViolations } from './a11y'
import { expectButtonsShowPointer } from './cursor'
import { mainColumn, openEntries } from './workspace'

async function expectHealthy(page: Page): Promise<void> {
  await expectNoA11yViolations(page)
  await expectButtonsShowPointer(page)
}

test('the sidebar filters and pages entries, then opens one whose past analyses can be switched', async ({ page }) => {
  // Arrange
  await page.goto('/')
  const entries = await openEntries(page)
  const rows = entries.getByRole('list', { name: 'Entries' }).getByRole('listitem')
  await expect(rows).toHaveCount(10)
  await expectHealthy(page)
  // Act
  await entries.getByRole('button', { name: 'Load more' }).click()
  await expect(rows).toHaveCount(14)
  await entries.getByLabel('Filter by language').selectOption('fr')
  await expect(rows).toHaveCount(4)
  await expectHealthy(page)
  await entries.getByRole('link', { name: /Je suis allé au marché/ }).click()
  // Assert
  const main = mainColumn(page)
  await expect(main.getByRole('heading', { level: 1, name: 'Entry' })).toBeFocused()
  await expect(main.getByText('Great job — no mistakes found!')).toBeVisible()
  await expect(page).toHaveURL(/[?&]entry=00000000-0000-4000-8000-000000000001/)
  await expectHealthy(page)
  await main.getByLabel('Analysis').selectOption({ index: 1 })
  await expect(main.getByRole('button', { name: /à le/ })).toBeVisible()
  await expectHealthy(page)
})

test('an empty journal offers a way to start writing', async ({ page }) => {
  // Arrange
  await page.goto('/?mock=empty')
  const entries = await openEntries(page)
  // Act
  await entries.getByRole('button', { name: 'Write your first entry' }).click()
  // Assert
  await expect(page.getByLabel('Your entry')).toBeFocused()
  await expectHealthy(page)
})

test('an interrupted analysis is flagged in the sidebar and can be retried in place', async ({ page }) => {
  // Arrange
  await page.goto('/')
  const entries = await openEntries(page)
  const row = entries.getByRole('listitem').filter({ hasText: 'Hier, je suis allé' })
  await expect(row.getByText('Analysis interrupted')).toBeVisible()
  await expectHealthy(page)
  // Act
  await row.getByRole('button', { name: /^Retry analysis/ }).click()
  // Assert
  await expect(row.getByText('1 error')).toBeVisible()
  await expect(row.getByRole('button', { name: /^Retry analysis/ })).toBeHidden()
  await expectHealthy(page)
})

test('an unknown entry explains itself and offers a new entry', async ({ page }) => {
  // Arrange
  await page.goto('/?entry=ffffffff-ffff-4fff-8fff-ffffffffffff')
  const main = mainColumn(page)
  await expect(main.getByRole('heading', { level: 1, name: 'Entry not found' })).toBeVisible()
  await expectHealthy(page)
  // Act
  await main.getByRole('link', { name: 'Write a new entry' }).click()
  // Assert
  await expect(page.getByLabel('Your entry')).toBeFocused()
})
```

`frontend/e2e/write.spec.ts` — scope to the main column (the sidebar has "Get feedback: …" row buttons and its own status line) and use the exact composer label:
- add `import { composerLanguage, mainColumn } from './workspace'`;
- `writeEntry`: `await composerLanguage(page).selectOption('es')`;
- every `page.getByRole('button', { name: 'Get feedback' })` → `mainColumn(page).getByRole('button', { name: 'Get feedback' })`;
- every `page.getByRole('status')` → `mainColumn(page).getByRole('status')`;
- `page.getByRole('button', { name: 'New entry' })` → `mainColumn(page).getByRole('button', { name: 'New entry' })`;
- the remembered-language test: both `page.getByLabel('Language')` → `composerLanguage(page)`.

`frontend/e2e/insights.spec.ts` — interim edits (Task 6 rewrites this file):
- replace the `nav` helper with `const insightsLink = (page: Page) => page.getByRole('link', { name: 'Insights', exact: true })` and use it for both `nav(page, 'Insights')` calls;
- `nav(page, 'Write').click()` → `page.getByRole('link', { name: 'Back to your journal' }).click()`;
- in that test, `page.getByLabel('Language').selectOption('fr')` (the composer) → `composerLanguage(page).selectOption('fr')` and `page.getByRole('button', { name: 'Get feedback' })` → `mainColumn(page).getByRole('button', { name: 'Get feedback' })`;
- every other `page.getByLabel('Language')` (the insights filter) → `page.getByLabel('Filter by language')`;
- add `import { composerLanguage, mainColumn } from './workspace'`.

- [ ] **Step 9: Run the frontend gate**

Run: `pnpm -C frontend verify`
Expected: `ALL GATES GREEN`. If fallow reports `RetryAnalysisButton` or `TextLink` imports as unused, remove the stale import — never the check.

- [ ] **Step 10: Commit**

```bash
git add frontend/src frontend/e2e
git commit -m "feat(frontend): single-screen workspace with entries sidebar and in-place entry view"
```

---
### Task 6: Insights as a sheet

**Files:**
- Create: `frontend/src/features/workspace/{InsightsSheet.tsx,Workspace.insights.test.tsx}`
- Modify: `frontend/src/features/workspace/{Workspace.tsx,WorkspaceHeader.tsx}`, `frontend/src/pages/LegacyRedirects.tsx`, `frontend/src/AppRoutes.tsx`, `frontend/src/AppRoutes.test.tsx`, `frontend/e2e/insights.spec.ts`
- Delete: `frontend/src/pages/InsightsPage.tsx`

**Interfaces:**
- Consumes: `Sheet` (Task 2), `useWorkspaceParams`, `useMediaQuery`, `DESKTOP_QUERY` (Task 4), `InsightsScreen`.
- Produces:
  - `InsightsSheet()` — open iff `insights=1`; `side` `right` on `lg`+, `bottom` below; title "Insights", description "How your errors change as you write. Suggestions and word help don’t count."; close → `closeInsights()`.
  - `WorkspaceHeader({ insightsOpen: boolean, onOpenInsights: () => void })` — "Insights" secondary button with `aria-haspopup="dialog"` and `aria-expanded`.
  - `InsightsRedirect` — `/insights` → `/?insights=1` (query kept).

- [ ] **Step 1: Write the failing tests**

`frontend/src/features/workspace/Workspace.insights.test.tsx`:
```tsx
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { LocationProbe } from '@/test/LocationProbe'
import { renderWithProviders } from '@/test/renderWithProviders'
import { Workspace } from './Workspace'

function renderWorkspace(route = '/') {
  renderWithProviders(
    <>
      <Workspace />
      <LocationProbe />
    </>,
    { route },
  )
  return userEvent.setup()
}

const dialog = () => screen.getByRole('dialog', { name: 'Insights' })
const insightsButton = () => screen.getByRole('button', { name: 'Insights' })
const location = () => screen.getByLabelText('Location')

describe('Workspace insights', () => {
  it('opens from the header as a dialog focused on its heading and recorded in the URL', async () => {
    // Arrange
    const user = renderWorkspace()
    // Act
    await user.click(insightsButton())
    // Assert
    expect(within(dialog()).getByRole('heading', { level: 2, name: 'Insights' })).toHaveFocus()
    expect(insightsButton()).toHaveAttribute('aria-expanded', 'true')
    expect(location()).toHaveTextContent('/?insights=1')
    expect(await within(dialog()).findByRole('region', { name: 'Summary' })).toBeInTheDocument()
  })

  it('closes on Escape by going Back, and returns focus to the header button', async () => {
    // Arrange
    const user = renderWorkspace('/?language=fr')
    await user.click(insightsButton())
    // Act
    await user.keyboard('{Escape}')
    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(location()).toHaveTextContent(/^\/\?language=fr$/)
    expect(insightsButton()).toHaveFocus()
  })

  it('opens from a deep link and closes without leaving the app', async () => {
    // Arrange
    const user = renderWorkspace('/?insights=1&language=fr')
    expect(await within(dialog()).findByText('Trends start at 4 entries with feedback.')).toBeInTheDocument()
    // Act
    await user.click(within(dialog()).getByRole('button', { name: 'Close' }))
    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(location()).toHaveTextContent(/^\/\?language=fr$/)
  })

  it('filters insights and the entries sidebar together', async () => {
    // Arrange
    const user = renderWorkspace('/?insights=1')
    const filter = await within(dialog()).findByLabelText('Filter by language')
    await within(filter).findByRole('option', { name: 'Spanish' })
    // Act
    await user.selectOptions(filter, 'es')
    await user.click(within(dialog()).getByRole('button', { name: 'Close' }))
    // Assert
    const sidebar = screen.getByRole('complementary', { name: 'Your entries' })
    expect(await within(sidebar).findByLabelText('Filter by language')).toHaveValue('es')
    expect(location()).toHaveTextContent(/^\/\?language=es$/)
  })
})
```

`frontend/src/AppRoutes.test.tsx` — add the redirect row and fix the title row:
- redirect table: add `['/insights?language=fr', '/?language=fr&insights=1'],`
- titles table: `['/insights', 'Insights · Language Journal']` → `['/?insights=1', 'Write · Language Journal']` (the document title follows the main column; the sheet is a layer over it)
- add:
  ```tsx
  it('opens insights as a sheet for the old /insights link', async () => {
    // Arrange + Act
    renderAt('/insights')
    // Assert
    expect(await screen.findByRole('dialog', { name: 'Insights' })).toBeInTheDocument()
  })
  ```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm -C frontend exec vitest run src/features/workspace src/AppRoutes.test.tsx`
Expected: FAIL — no "Insights" button, no dialog, `/insights` still a page.

- [ ] **Step 3: Implement**

`frontend/src/features/workspace/InsightsSheet.tsx`:
```tsx
import { Sheet } from '@/components/ui/Sheet'
import { InsightsScreen } from '@/features/insights/InsightsScreen'
import { useMediaQuery } from '@/hooks/misc/useMediaQuery'
import { useWorkspaceParams } from '@/hooks/misc/useWorkspaceParams'
import { DESKTOP_QUERY } from '@/utils/constants'

// A layer over the workspace, never a place: closing it lands exactly where the learner was.
export function InsightsSheet() {
  const { insightsOpen, closeInsights } = useWorkspaceParams()
  const desktop = useMediaQuery(DESKTOP_QUERY, true)
  return (
    <Sheet
      open={insightsOpen}
      onClose={closeInsights}
      side={desktop ? 'right' : 'bottom'}
      title="Insights"
      description="How your errors change as you write. Suggestions and word help don’t count."
    >
      <InsightsScreen />
    </Sheet>
  )
}
```

`frontend/src/features/workspace/WorkspaceHeader.tsx`:
```tsx
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'

export interface WorkspaceHeaderProps {
  insightsOpen: boolean
  onOpenInsights: () => void
}

// The gradient band lives here only (DESIGN.md): it marks the frame, never the writing.
export function WorkspaceHeader({ insightsOpen, onOpenInsights }: WorkspaceHeaderProps) {
  return (
    <header className="border-b border-border bg-linear-to-b from-band to-bg">
      <div className="mx-auto flex max-w-content items-center gap-3 px-4 py-3 lg:px-6">
        <Link to="/" className="text-lg font-light tracking-tight text-fg">
          Language Journal
        </Link>
        <Button className="ml-auto" aria-haspopup="dialog" aria-expanded={insightsOpen} onClick={onOpenInsights}>
          <Icon name="chart" />
          Insights
        </Button>
      </div>
    </header>
  )
}
```

`frontend/src/features/workspace/Workspace.tsx` — read the flag, pass it to the header, render the sheet:
```tsx
  const { entryId, insightsOpen, selectEntry, openInsights } = useWorkspaceParams()
  …
      <WorkspaceHeader insightsOpen={insightsOpen} onOpenInsights={openInsights} />
  …
      </div>
      <InsightsSheet />
    </div>
```
(add `import { InsightsSheet } from './InsightsSheet'`).

`frontend/src/pages/LegacyRedirects.tsx` — append:
```tsx
export function InsightsRedirect() {
  const target = useWorkspaceTarget({ insights: '1' })
  return <Navigate replace to={target} />
}
```

`frontend/src/AppRoutes.tsx`: import `InsightsRedirect` instead of `InsightsPage`; `<Route path="insights" element={<InsightsRedirect />} />`. Then `git rm frontend/src/pages/InsightsPage.tsx`.

- [ ] **Step 4: Run the unit tests**

Run: `pnpm -C frontend exec vitest run`
Expected: PASS.

- [ ] **Step 5: Rewrite the insights e2e spec**

`frontend/e2e/insights.spec.ts`:
```ts
import { expect, test, type Page } from '@playwright/test'
import { expectNoA11yViolations } from './a11y'
import { expectButtonsShowPointer } from './cursor'
import { composerLanguage, mainColumn } from './workspace'

async function expectHealthy(page: Page): Promise<void> {
  await expectNoA11yViolations(page)
  await expectButtonsShowPointer(page)
}

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

const insights = (page: Page) => page.getByRole('dialog', { name: 'Insights' })
const summary = (page: Page) => insights(page).getByRole('region', { name: 'Summary' })

async function openInsights(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Insights', exact: true }).click()
  await expect(insights(page).getByRole('heading', { level: 2, name: 'Insights' })).toBeFocused()
}

test('insights open over the workspace with the summary, the chart and the categories', async ({ page }) => {
  // Arrange
  await page.goto('/')
  // Act
  await openInsights(page)
  // Assert
  await expect(page).toHaveURL('/?insights=1')
  await expect(summary(page)).toContainText('6 errors across 11 entries — 7.6 per 100 words.')
  await expect(insights(page).getByRole('img', { name: /across 11 entries.*Overall: steady/ })).toBeVisible()
  await expect(insights(page).getByRole('row', { name: /Verb conjugation/ })).toContainText('Getting worse')
  await expect(insights(page).getByRole('row', { name: /Article/ })).toContainText('Improving')
  await expectHealthy(page)
  await expectNoHorizontalScroll(page)
})

test('the filter narrows insights, and below three entries offers a way to write', async ({ page }) => {
  // Arrange
  await page.goto('/?insights=1')
  await expect(summary(page)).toBeVisible()
  // Act
  await insights(page).getByLabel('Filter by language').selectOption('es')
  // Assert
  await expect(page).toHaveURL(/language=es/)
  await expect(summary(page)).toContainText('Verb conjugation keeps recurring: 3 of your last 5 entries.')
  await expect(insights(page).getByRole('row', { name: /Verb conjugation/ })).toContainText('Recurring · 3 of last 5')
  await expectHealthy(page)
  await insights(page).getByLabel('Filter by language').selectOption('de')
  await expect(insights(page).getByText('Insights start after 3 entries with feedback — 3 to go.')).toBeVisible()
  await expectHealthy(page)
  await insights(page).getByRole('link', { name: 'Write an entry' }).click()
  await expect(insights(page)).toBeHidden()
  await expect(mainColumn(page).getByRole('heading', { level: 1 })).toHaveText('Write')
})

test('a new entry with feedback changes insights that were already loaded', async ({ page }) => {
  // Arrange
  await page.goto('/?language=fr')
  await openInsights(page)
  await expect(summary(page)).toContainText('0 errors across 3 entries')
  await page.keyboard.press('Escape')
  await expect(insights(page)).toBeHidden()
  await composerLanguage(page).selectOption('fr')
  await page.getByLabel('Your entry').fill('Je vais à le cinéma ce soir.')
  // Act
  await mainColumn(page).getByRole('button', { name: 'Get feedback' }).click()
  await expect(mainColumn(page).getByRole('heading', { name: 'Feedback' })).toBeVisible()
  await openInsights(page)
  // Assert
  await expect(summary(page)).toContainText('Article is getting worse (0.0 → 6.7 per 100 words).')
  await expectHealthy(page)
})

test('Back closes insights and Forward reopens them', async ({ page }) => {
  // Arrange
  await page.goto('/')
  await openInsights(page)
  // Act
  await page.goBack()
  // Assert
  await expect(insights(page)).toBeHidden()
  await expect(page).toHaveURL('/')
  await page.goForward()
  await expect(insights(page)).toBeVisible()
})

test('insights show loading, a single retry on failure and an empty state', async ({ page }) => {
  // Arrange
  await page.goto('/?insights=1&mock=slow')
  // Act
  const loading = insights(page).getByRole('status').filter({ hasText: 'Loading' })
  // Assert
  await expect(loading.first()).toBeVisible()
  await page.goto('/?insights=1&mock=error')
  await expect(insights(page).getByRole('alert')).toHaveCount(1)
  await expect(insights(page).getByRole('button', { name: 'Try again' })).toHaveCount(1)
  await expect(insights(page).getByRole('status')).toHaveCount(0)
  await expectHealthy(page)
  await page.goto('/?insights=1&mock=empty')
  await expect(insights(page).getByText('Not enough entries yet')).toBeVisible()
  await expectHealthy(page)
})

// The mock analyser cannot produce a long unbroken snippet, so the response is rewritten in the page, after MSW has answered.
async function withLongExample(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const original = window.fetch.bind(window)
    window.fetch = async (...args) => {
      const response = await original(...args)
      const target = args[0] instanceof Request ? args[0].url : String(args[0])
      if (!target.includes('/insights')) return response
      const body = await response.json()
      const long = 'x'.repeat(120)
      for (const category of body.categories) category.latest_example = { original: long, correction: long }
      return new Response(JSON.stringify(body), { status: response.status, headers: { 'content-type': 'application/json' } })
    }
  })
}

test('a long unbroken example wraps instead of scrolling the page sideways on a phone', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 375, height: 800 })
  await withLongExample(page)
  // Act
  await page.goto('/?insights=1')
  // Assert
  await expect(insights(page).getByRole('row', { name: /Verb conjugation/ })).toContainText('x'.repeat(120))
  await expectNoHorizontalScroll(page)
})
```

- [ ] **Step 6: Run the frontend gate**

Run: `pnpm -C frontend verify`
Expected: `ALL GATES GREEN`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src frontend/e2e
git commit -m "feat(frontend): insights open as a sheet over the workspace, driven by the URL"
```

---

### Task 7: Progress card, skeleton states and the header's language status

**Files:**
- Create: `frontend/src/features/workspace/{ProgressCard.tsx,ProgressSummary.tsx,Sparkline.tsx,LanguageStatus.tsx,ProgressCard.test.tsx}`, `frontend/src/features/insights/RateLines.tsx`
- Modify: `frontend/src/features/workspace/{Sidebar.tsx,Workspace.tsx,WorkspaceHeader.tsx,Workspace.test.tsx}`, `frontend/src/features/insights/{RateChart.tsx,InsightsResults.tsx}`, `frontend/src/features/history/HistoryResults.tsx`, `frontend/src/features/entry-detail/EntryDetail.tsx`, `frontend/e2e/insights.spec.ts`

**Interfaces:**
- Consumes: `useInsightsQuery`, `useLanguageFilter`, `useLanguageName`, `plotRuns`/`polylinePoints`/`CHART`, `describeRates`/`formatRate`, `TrendBadge`, `Card`, `Skeleton`, `LoadingState`, `Icon`.
- Produces:
  - `RateLines({ points: RatePointOut[] })` — the polylines shared by `RateChart` and `Sparkline` (keeps fallow's clone check quiet).
  - `Sparkline({ points, trend })` — `role="img"` labelled by `describeRates`.
  - `ProgressCard({ onOpenInsights })` — section "Progress": skeleton while the language list or insights load; error + retry; below four analysed entries "n more entries to see trends"; otherwise sparkline of the last ≤ 10 rates, trend badge and the overall rate; "Open insights" button. Nothing extra when the language list failed (the sidebar filter owns that single error and retry).
  - `Sidebar({ onNewEntry, onOpenInsights })`.
  - `LanguageStatus()` — header badge: the filter's language name or "All languages".
  - Loading states with skeletons: sidebar rows (4 × `h-14`), entry (title line + body), insights (summary + chart blocks).

- [ ] **Step 1: Write the failing tests**

`frontend/src/features/workspace/ProgressCard.test.tsx`:
```tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { failWith } from '@/test/helpers'
import { renderWithProviders } from '@/test/renderWithProviders'
import { server } from '@/test/server'
import { ENDPOINTS } from '@/utils/endpoints'
import { ProgressCard } from './ProgressCard'

const renderCard = (route = '/', onOpenInsights = vi.fn()) => {
  renderWithProviders(<ProgressCard onOpenInsights={onOpenInsights} />, { route })
  return userEvent.setup()
}

describe('ProgressCard', () => {
  it('shows a loading state, then a sparkline of the latest ten rates with the overall trend', async () => {
    // Arrange + Act
    renderCard()
    // Assert
    expect(screen.getByRole('status')).toHaveTextContent('Loading progress…')
    expect(await screen.findByRole('img', { name: /across 10 entries.*Overall: steady/ })).toBeInTheDocument()
    expect(screen.getByText(/Steady/)).toBeInTheDocument()
    expect(screen.getByText('7.6 per 100 words')).toBeInTheDocument()
  })

  it.each([
    ['/?language=fr', '1 more entry to see trends'],
    ['/?language=de', '4 more entries to see trends'],
  ])('counts down to trends for %s', async (route, message) => {
    // Arrange + Act
    renderCard(route)
    // Assert
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('opens insights from its button', async () => {
    // Arrange
    const onOpenInsights = vi.fn()
    const user = renderCard('/', onOpenInsights)
    // Act
    await user.click(screen.getByRole('button', { name: 'Open insights' }))
    // Assert
    expect(onOpenInsights).toHaveBeenCalledTimes(1)
  })

  it('offers a retry when progress cannot load', async () => {
    // Arrange
    failWith('get', ENDPOINTS.insights)
    const user = renderCard()
    expect(await screen.findByRole('alert')).toHaveTextContent(/on our side/)
    server.resetHandlers()
    // Act
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    // Assert
    expect(await screen.findByRole('img', { name: /across 10 entries/ })).toBeInTheDocument()
  })
})
```

Append to `frontend/src/features/workspace/Workspace.test.tsx`:
```tsx
  it('says in the header which language the workspace is filtered to', async () => {
    // Arrange + Act
    renderWorkspace('/?language=fr')
    // Assert
    expect(await within(screen.getByRole('banner')).findByText('French')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm -C frontend exec vitest run src/features/workspace`
Expected: FAIL — `./ProgressCard` not found; no language badge.

- [ ] **Step 3: Implement**

`frontend/src/features/insights/RateLines.tsx`:
```tsx
import type { RatePointOut } from '@/types/insights'
import { plotRuns, polylinePoints } from './chartGeometry'

// A null rate breaks the line (see plotRuns), so a run of one point has nothing to draw.
export function RateLines({ points }: { points: RatePointOut[] }) {
  return (
    <>
      {plotRuns(points)
        .filter((run) => run.length > 1)
        .map((run) => (
          <polyline key={run[0]?.id} points={polylinePoints(run)} strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="fill-none stroke-primary stroke-2" />
        ))}
    </>
  )
}
```

`frontend/src/features/insights/RateChart.tsx` — replace the `runs` block inside the `<svg>` with `<RateLines points={points} />`, delete `const runs = plotRuns(points)`, and import `RateLines` (drop the now-unused `plotRuns`/`polylinePoints` imports).

`frontend/src/features/workspace/Sparkline.tsx`:
```tsx
import { CHART } from '@/features/insights/chartGeometry'
import { describeRates } from '@/features/insights/format'
import { RateLines } from '@/features/insights/RateLines'
import type { RatePointOut, Trend } from '@/types/insights'

export interface SparklineProps {
  points: RatePointOut[]
  trend: Trend | null
}

// Same geometry as the insights chart, squashed to a strip; the label says the numbers for screen readers.
export function Sparkline({ points, trend }: SparklineProps) {
  return (
    <svg role="img" aria-label={describeRates(points, trend)} viewBox={`0 0 ${CHART.width} ${CHART.height}`} preserveAspectRatio="none" className="h-12 w-full overflow-visible">
      <RateLines points={points} />
    </svg>
  )
}
```

`frontend/src/features/workspace/ProgressSummary.tsx`:
```tsx
import { ErrorState } from '@/components/ui/ErrorState'
import { LoadingState } from '@/components/ui/LoadingState'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatRate } from '@/features/insights/format'
import { TrendBadge } from '@/features/insights/TrendCells'
import { useInsightsQuery } from '@/hooks/queries/useInsightsQuery'
import { toErrorMessage } from '@/utils/errorMessage'
import { pluralize } from '@/utils/formatter'
import { Sparkline } from './Sparkline'

// Trends need four analysed entries (main spec §8); the API reports fewer as `insufficient_data` or `totals_only`.
const TRENDS_AT = 4
const RECENT_POINTS = 10

export function ProgressLoading() {
  return (
    <LoadingState label="Loading progress…">
      <Skeleton className="h-12" />
    </LoadingState>
  )
}

export function ProgressSummary({ language }: { language: string | null }) {
  const insights = useInsightsQuery(language)
  const { data } = insights
  if (!data) {
    if (insights.isError) return <ErrorState message={toErrorMessage(insights.error)} onRetry={() => void insights.refetch()} />
    return <ProgressLoading />
  }
  if (data.status !== 'trends') {
    const missing = Math.max(TRENDS_AT - data.entry_count, 1)
    return <p className="text-sm text-muted">{`${pluralize(missing, 'more entry', 'more entries')} to see trends`}</p>
  }
  return (
    <div className="flex flex-col gap-2">
      <Sparkline points={data.points.slice(-RECENT_POINTS)} trend={data.trend} />
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <TrendBadge trend={data.trend} />
        <span className="text-fg-secondary tabular-nums">{`${formatRate(data.error_rate)} per 100 words`}</span>
      </p>
    </div>
  )
}
```

`frontend/src/features/workspace/ProgressCard.tsx`:
```tsx
import { useId } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { useLanguageFilter } from '@/features/languages/useLanguageFilter'
import { ProgressLoading, ProgressSummary } from './ProgressSummary'

export interface ProgressCardProps {
  onOpenInsights: () => void
}

// Same query and filter as the insights sheet, so opening it shows the same numbers instantly from the cache.
export function ProgressCard({ onOpenInsights }: ProgressCardProps) {
  const headingId = useId()
  const filter = useLanguageFilter()
  return (
    <Card as="section" aria-labelledby={headingId} className="flex flex-col gap-3 bg-surface shadow-none md:p-4">
      <h2 id={headingId} className="text-sm font-medium text-fg-secondary">
        Progress
      </h2>
      {filter.state === 'ready' && <ProgressSummary language={filter.language} />}
      {filter.state === 'pending' && <ProgressLoading />}
      <Button onClick={onOpenInsights}>
        <Icon name="chart" />
        Open insights
      </Button>
    </Card>
  )
}
```

`frontend/src/features/workspace/LanguageStatus.tsx`:
```tsx
import { Badge } from '@/components/ui/Badge'
import { useLanguageFilter } from '@/features/languages/useLanguageFilter'
import { useLanguageName } from '@/features/languages/useLanguageName'

export function LanguageStatus() {
  const { language } = useLanguageFilter()
  const name = useLanguageName(language ?? '')
  return <Badge>{language ? name : 'All languages'}</Badge>
}
```

`frontend/src/features/workspace/Sidebar.tsx` — take `onOpenInsights` and add the card after the history section:
```tsx
export interface SidebarProps {
  onNewEntry: () => void
  onOpenInsights: () => void
}
…
      <ProgressCard onOpenInsights={onOpenInsights} />
    </div>
```
(add `import { ProgressCard } from './ProgressCard'`).

`frontend/src/features/workspace/Workspace.tsx`: `<Sidebar onNewEntry={startNewEntry} onOpenInsights={openInsights} />`.

`frontend/src/features/workspace/WorkspaceHeader.tsx`: after the brand `Link`, add `<LanguageStatus />` (import it).

Skeleton loading states (add `Skeleton` imports):
- `HistoryResults.tsx`:
  ```tsx
  const ROW_PLACEHOLDERS = [0, 1, 2, 3].map((n) => <Skeleton key={n} className="h-14" />)
  …
  if (entries.isPending) return <LoadingState label="Loading entries…">{ROW_PLACEHOLDERS}</LoadingState>
  ```
- `EntryDetail.tsx` (`EntryDetailBody`):
  ```tsx
  if (!entry.data || !analyses.data) {
    return (
      <LoadingState label="Loading entry…">
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-40" />
      </LoadingState>
    )
  }
  ```
- `InsightsResults.tsx`:
  ```tsx
    return (
      <LoadingState label="Loading insights…">
        <Skeleton className="h-20" />
        <Skeleton className="h-48" />
      </LoadingState>
    )
  ```

- [ ] **Step 4: Run the unit tests**

Run: `pnpm -C frontend exec vitest run`
Expected: PASS (existing "Loading entries…/entry…/insights…" assertions still read the `sr-only` label).

- [ ] **Step 5: Add the progress-card journey**

Append to `frontend/e2e/insights.spec.ts` (and `import { openEntries } from './workspace'`):
```ts
test('the progress card in the sidebar opens insights for the same language', async ({ page }) => {
  // Arrange
  await page.goto('/?language=es')
  const entries = await openEntries(page)
  const progress = entries.getByRole('region', { name: 'Progress' })
  await expect(progress.getByRole('img', { name: /Errors per 100 words/ })).toBeVisible()
  await expectHealthy(page)
  // Act
  await progress.getByRole('button', { name: 'Open insights' }).click()
  // Assert
  await expect(summary(page)).toContainText('Verb conjugation keeps recurring')
})
```

- [ ] **Step 6: Run the frontend gate**

Run: `pnpm -C frontend verify`
Expected: `ALL GATES GREEN`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src frontend/e2e
git commit -m "feat(frontend): sidebar progress card, skeleton loading states, header language badge"
```

---
### Task 8: Phone layout — entries in a left sheet

Below `lg` (1024px) the sidebar leaves the page and opens from a header "Entries" button as a left sheet. Exactly one `Sidebar` is mounted at a time (aside on desktop, sheet on phones), so ids, labels and the `Entries` list name never repeat.

**Files:**
- Create: `frontend/src/features/workspace/{useEntriesSheet.ts,Workspace.mobile.test.tsx}`
- Modify: `frontend/src/features/workspace/{Workspace.tsx,WorkspaceHeader.tsx}`, `frontend/e2e/workspace.ts`

**Interfaces:**
- Consumes: `Sheet`, `useMediaQuery(DESKTOP_QUERY, true)`, `Sidebar`, `Icon`.
- Produces:
  - `useEntriesSheet(moment: string): { open: boolean; show(): void; hide(): void }` — the sheet belongs to the moment it opened in; any change of `moment` (entry picked, "New entry", insights opened) closes it, and going Back to that moment does not reopen it.
  - `WorkspaceHeader({ insightsOpen, onOpenInsights, children? })` — `children` render before the brand (the phone-only "Entries" button).
  - e2e `openEntries(page)` clicks "Entries" when it is visible and returns the dialog; otherwise returns the aside.

- [ ] **Step 1: Write the failing tests**

`frontend/src/features/workspace/Workspace.mobile.test.tsx`:
```tsx
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocationProbe } from '@/test/LocationProbe'
import { renderWithProviders } from '@/test/renderWithProviders'
import { Workspace } from './Workspace'

// A phone: every media query answers "no", so the desktop sidebar query fails.
beforeEach(() => {
  vi.stubGlobal('matchMedia', (media: string) => ({ matches: false, media, addEventListener: () => undefined, removeEventListener: () => undefined }))
})
afterEach(() => vi.unstubAllGlobals())

async function openEntriesSheet() {
  renderWithProviders(
    <>
      <Workspace />
      <LocationProbe />
    </>,
  )
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Entries' }))
  return user
}

const sheet = () => screen.getByRole('dialog', { name: 'Entries' })
const main = () => screen.getByRole('main')

describe('Workspace on a phone', () => {
  it('keeps the entries in a sheet opened from the header', async () => {
    // Arrange + Act
    await openEntriesSheet()
    // Assert
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    expect(within(sheet()).getByRole('heading', { level: 2, name: 'Entries' })).toHaveFocus()
    expect(await within(sheet()).findByRole('list', { name: 'Entries' })).toBeInTheDocument()
  })

  it('closes when an entry is picked and focuses that entry, not the Entries button', async () => {
    // Arrange
    const user = await openEntriesSheet()
    // Act
    await user.click(await within(sheet()).findByRole('link', { name: /Je suis allé au marché/ }))
    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await within(main()).findByRole('heading', { level: 1, name: 'Entry' })).toHaveFocus()
  })

  it('closes on "New entry" and focuses the editor', async () => {
    // Arrange
    const user = await openEntriesSheet()
    // Act
    await user.click(within(sheet()).getByRole('button', { name: 'New entry' }))
    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(within(main()).getByLabelText('Your entry')).toHaveFocus()
  })

  it('stays closed when the learner goes Back after picking an entry', async () => {
    // Arrange
    const user = await openEntriesSheet()
    await user.click(await within(sheet()).findByRole('link', { name: /Je suis allé au marché/ }))
    await within(main()).findByRole('heading', { level: 1, name: 'Entry' })
    // Act
    await user.click(screen.getByRole('button', { name: 'Go back' }))
    // Assert
    expect(await within(main()).findByRole('heading', { level: 1, name: 'Write' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('makes way for insights opened from the progress card', async () => {
    // Arrange
    const user = await openEntriesSheet()
    // Act
    await user.click(within(sheet()).getByRole('button', { name: 'Open insights' }))
    // Assert
    expect(screen.queryByRole('dialog', { name: 'Entries' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Insights' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm -C frontend exec vitest run src/features/workspace/Workspace.mobile.test.tsx`
Expected: FAIL — no "Entries" button.

- [ ] **Step 3: Implement**

`frontend/src/features/workspace/useEntriesSheet.ts`:
```ts
import { useState } from 'react'

// The sheet belongs to the moment it was opened in (entry | composer key | insights): any navigation closes it,
// and the stored moment is reset so Back to that moment does not reopen it.
export function useEntriesSheet(moment: string) {
  const [sheet, setSheet] = useState({ moment, open: false })
  if (sheet.moment !== moment) setSheet({ moment, open: false })
  return {
    open: sheet.open && sheet.moment === moment,
    show: () => setSheet({ moment, open: true }),
    hide: () => setSheet({ moment, open: false }),
  }
}
```

`frontend/src/features/workspace/WorkspaceHeader.tsx` — add the slot:
```tsx
import type { ReactNode } from 'react'
…
export interface WorkspaceHeaderProps {
  insightsOpen: boolean
  onOpenInsights: () => void
  // Rendered before the brand: the phone-only "Entries" button.
  children?: ReactNode
}

export function WorkspaceHeader({ insightsOpen, onOpenInsights, children }: WorkspaceHeaderProps) {
  …
      <div className="mx-auto flex max-w-content items-center gap-3 px-4 py-3 lg:px-6">
        {children}
        …brand, LanguageStatus, Insights button unchanged…
```

`frontend/src/features/workspace/Workspace.tsx` (whole file):
```tsx
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Sheet } from '@/components/ui/Sheet'
import { useChangedSinceMount } from '@/hooks/misc/useChangedSinceMount'
import { useMediaQuery } from '@/hooks/misc/useMediaQuery'
import { useWorkspaceParams } from '@/hooks/misc/useWorkspaceParams'
import { DESKTOP_QUERY } from '@/utils/constants'
import { InsightsSheet } from './InsightsSheet'
import { MainColumn } from './MainColumn'
import { Sidebar } from './Sidebar'
import { useEntriesSheet } from './useEntriesSheet'
import { WorkspaceHeader } from './WorkspaceHeader'

export function Workspace() {
  const { entryId, insightsOpen, selectEntry, openInsights } = useWorkspaceParams()
  // Desktop in jsdom (no matchMedia): most component tests exercise the two-column layout.
  const desktop = useMediaQuery(DESKTOP_QUERY, true)
  // Bumped by "New entry" so a finished session starts over even when no entry was selected.
  const [composerKey, setComposerKey] = useState(0)
  const place = `${entryId ?? ''}|${composerKey}`
  // False on first load, so a deep link never steals focus; true once the learner moves within the workspace.
  const moved = useChangedSinceMount(place)
  const entriesSheet = useEntriesSheet(`${place}|${insightsOpen}`)
  const startNewEntry = () => {
    selectEntry(null)
    setComposerKey((key) => key + 1)
  }
  const sidebar = <Sidebar onNewEntry={startNewEntry} onOpenInsights={openInsights} />
  return (
    <div className="flex min-h-screen flex-col">
      <WorkspaceHeader insightsOpen={insightsOpen} onOpenInsights={openInsights}>
        {!desktop && (
          <Button variant="ghost" className="-ml-2 px-3" aria-haspopup="dialog" aria-expanded={entriesSheet.open} onClick={entriesSheet.show}>
            <Icon name="menu" />
            Entries
          </Button>
        )}
      </WorkspaceHeader>
      <div className="mx-auto flex w-full max-w-content flex-1 gap-8 px-4 lg:px-6">
        {desktop && (
          <aside aria-label="Your entries" className="w-sidebar shrink-0 border-r border-border py-6 pr-6">
            {sidebar}
          </aside>
        )}
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 py-6">
          <div className="mx-auto flex max-w-main flex-col gap-6">
            <MainColumn entryId={entryId} composerKey={composerKey} moved={moved} />
          </div>
        </main>
      </div>
      {!desktop && (
        <Sheet open={entriesSheet.open} onClose={entriesSheet.hide} side="left" title="Entries">
          {sidebar}
        </Sheet>
      )}
      <InsightsSheet />
    </div>
  )
}
```

`frontend/e2e/workspace.ts` — `openEntries` becomes:
```ts
/** The entries sidebar: the left column on desktop, a sheet behind the header's "Entries" button on phones. */
export async function openEntries(page: Page): Promise<Locator> {
  const button = page.getByRole('button', { name: 'Entries', exact: true })
  if (await button.isVisible()) {
    await button.click()
    return page.getByRole('dialog', { name: 'Entries' })
  }
  return page.getByRole('complementary', { name: 'Your entries' })
}
```

- [ ] **Step 4: Run the unit tests**

Run: `pnpm -C frontend exec vitest run`
Expected: PASS (desktop tests unchanged: jsdom has no `matchMedia`, so the fallback keeps the aside).

- [ ] **Step 5: Run the frontend gate**

Run: `pnpm -C frontend verify`
Expected: `ALL GATES GREEN` — the mobile Playwright project now goes through the sheet in `smoke`, `history` and the progress-card journey.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/workspace frontend/e2e/workspace.ts
git commit -m "feat(frontend): entries open as a left sheet on phones"
```

---

### Task 9: Feedback polish — corrected/original tabs, legend tooltips, background toasts

**Files:**
- Create: `frontend/src/features/feedback/TextVersions.tsx`, `frontend/src/features/write/useBackgroundToasts.ts`, `frontend/src/hooks/mutations/useRunAnalysisMutation.test.tsx`, `frontend/src/features/workspace/Workspace.toast.test.tsx`
- Modify: `frontend/src/features/feedback/{FeedbackView.tsx,FeedbackView.test.tsx,Legend.tsx,labels.ts}`, `frontend/src/hooks/mutations/useRunAnalysisMutation.ts`, `frontend/src/features/write/{useWriteSession.ts,WriteScreen.tsx}`, `frontend/e2e/write.spec.ts`

**Interfaces:**
- Consumes: `AnimatedTabs`, `tabId`, `panelId`, `Tooltip`, `useToast` (Task 3).
- Produces:
  - `TextVersions({ analysis, onSwitch, children })` — tabs "Your text" / "Corrected" (tablist "Text version") over one `role="tabpanel"`; `children` is the annotated original.
  - `KIND_HINTS: Record<MistakeKind, string>` in `features/feedback/labels.ts`; legend chips carry them as tooltips.
  - `useRunAnalysisMutation(callbacks?: AnalysisCallbacks)`, `AnalysisCallbacks = { onAnalysed?: (analysis: AnalysisOut) => void; onFailed?: (error: Error) => void }` — hook-level, so they run even after the caller unmounted.
  - `useWriteSession(onSaved: () => void, callbacks?: AnalysisCallbacks)`.
  - `useBackgroundToasts(): AnalysisCallbacks` — toasts only while the composer is unmounted.

Deviation: the design lists a "saved" toast too. The composer's status line already announces "Saved" (`role="status"`) where the learner is looking; a toast would announce it twice. Toasts are kept for outcomes the learner cannot see: the analysis of a new entry that finishes after they opened another entry.

- [ ] **Step 1: Write the failing tests**

`frontend/src/features/feedback/FeedbackView.test.tsx` — replace the "toggles the corrected version" test and add the tooltip test (import `KIND_HINTS` from `./labels`):
```tsx
  it('switches to the corrected version in a tab and hides the highlights meanwhile', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<FeedbackView analysis={analysis} />)
    // Act
    await user.click(screen.getByRole('tab', { name: 'Corrected' }))
    // Assert
    expect(screen.getByRole('tab', { name: 'Corrected' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel', { name: 'Corrected' })).toHaveTextContent('Hoy 😀 yo soy feliz en el parque.')
    expect(screen.queryByRole('button', { name: /yo es/ })).not.toBeInTheDocument()
  })

  it('explains what each kind of mark means', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<FeedbackView analysis={analysis} />)
    // Act
    await user.click(screen.getByText('Suggestion'))
    // Assert
    expect(screen.getByRole('tooltip')).toHaveTextContent(KIND_HINTS.suggestion)
  })
```

`frontend/src/hooks/mutations/useRunAnalysisMutation.test.tsx`:
```tsx
import { act, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SEEDED } from '@/mocks/seed'
import { failWith, slowDown } from '@/test/helpers'
import { renderHookWithProviders } from '@/test/renderWithProviders'
import { ENDPOINTS } from '@/utils/endpoints'
import { useRunAnalysisMutation } from './useRunAnalysisMutation'

describe('useRunAnalysisMutation callbacks', () => {
  it('report the outcome even after the caller unmounted', async () => {
    // Arrange
    slowDown('post', ENDPOINTS.analyses(':entryId'))
    const onAnalysed = vi.fn()
    const { result, unmount } = renderHookWithProviders(() => useRunAnalysisMutation({ onAnalysed }))
    // Act
    act(() => result.current.mutate(SEEDED.unanalysed))
    unmount()
    // Assert
    await waitFor(() => expect(onAnalysed).toHaveBeenCalledWith(expect.objectContaining({ entry_id: SEEDED.unanalysed, status: 'succeeded' })))
  })

  it('report a request that never produced an analysis', async () => {
    // Arrange
    failWith('post', ENDPOINTS.analyses(':entryId'))
    const onFailed = vi.fn()
    const { result } = renderHookWithProviders(() => useRunAnalysisMutation({ onFailed }))
    // Act
    act(() => result.current.mutate(SEEDED.unanalysed))
    // Assert
    await waitFor(() => expect(onFailed).toHaveBeenCalledTimes(1))
  })
})
```

`frontend/src/features/workspace/Workspace.toast.test.tsx`:
```tsx
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { setMockMode, slowDown, waitForLanguages } from '@/test/helpers'
import { renderWithProviders } from '@/test/renderWithProviders'
import { ENDPOINTS } from '@/utils/endpoints'
import { Workspace } from './Workspace'

const main = () => screen.getByRole('main')
const sidebar = () => screen.getByRole('complementary', { name: 'Your entries' })

async function submitEntry() {
  const user = userEvent.setup()
  renderWithProviders(<Workspace />)
  await waitForLanguages()
  await user.type(within(main()).getByLabelText('Your entry'), 'Hoy yo es feliz.')
  await user.click(within(main()).getByRole('button', { name: 'Get feedback' }))
  return user
}

async function leaveWhileAnalysing(user: ReturnType<typeof userEvent.setup>) {
  await within(main()).findByText('Saved. Analyzing…')
  await user.click(await within(sidebar()).findByRole('link', { name: /Je suis allé au marché/ }))
}

describe('Workspace background toasts', () => {
  it('tells the learner when feedback arrives after they left the composer', async () => {
    // Arrange
    slowDown('post', ENDPOINTS.analyses(':entryId'), 300)
    const user = await submitEntry()
    // Act
    await leaveWhileAnalysing(user)
    // Assert
    const toast = await screen.findByText(/Feedback is ready/)
    expect(toast.closest('[role="status"]')).not.toBeNull()
  })

  it('says so when that analysis fails', async () => {
    // Arrange
    setMockMode('analysis-fail')
    slowDown('post', ENDPOINTS.analyses(':entryId'), 300)
    const user = await submitEntry()
    // Act
    await leaveWhileAnalysing(user)
    // Assert
    expect(await screen.findByText(/did not finish/)).toBeInTheDocument()
  })

  it('stays quiet while the feedback appears where the learner is looking', async () => {
    // Arrange + Act
    await submitEntry()
    // Assert
    expect(await within(main()).findByRole('heading', { name: 'Feedback' })).toBeInTheDocument()
    expect(screen.queryByText(/Feedback is ready/)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm -C frontend exec vitest run src/features/feedback src/hooks/mutations src/features/workspace/Workspace.toast.test.tsx`
Expected: FAIL — no tabs, no tooltip, callbacks ignored, no toasts.

- [ ] **Step 3: Tabs for the text versions**

`frontend/src/features/feedback/TextVersions.tsx`:
```tsx
import { useId, useState, type ReactNode } from 'react'
import { AnimatedTabs, panelId, tabId } from '@/components/ui/AnimatedTabs'
import type { AnalysisOut } from '@/types/analysis'

const VERSIONS = [
  { id: 'original', label: 'Your text' },
  { id: 'corrected', label: 'Corrected' },
] as const

export interface TextVersionsProps {
  analysis: AnalysisOut
  // Called before switching, so an open mistake panel never points at text that is no longer shown.
  onSwitch: () => void
  // The annotated original, with its highlight buttons.
  children: ReactNode
}

export function TextVersions({ analysis, onSwitch, children }: TextVersionsProps) {
  const [version, setVersion] = useState<string>('original')
  const prefix = useId()
  const corrected = version === 'corrected'
  return (
    <div className="flex flex-col gap-3">
      <div>
        <AnimatedTabs
          label="Text version"
          idPrefix={prefix}
          tabs={VERSIONS}
          value={version}
          onChange={(id) => {
            onSwitch()
            setVersion(id)
          }}
        />
      </div>
      <div role="tabpanel" id={panelId(prefix, version)} aria-labelledby={tabId(prefix, version)} tabIndex={corrected ? 0 : undefined}>
        {corrected ? <p className="text-lg leading-loose whitespace-pre-wrap">{analysis.corrected_text ?? analysis.input_text}</p> : children}
      </div>
    </div>
  )
}
```

`frontend/src/features/feedback/FeedbackView.tsx` — drop `showCorrected`/`toggleCorrected` and the toggle button; render:
```tsx
      <Legend mistakes={analysis.mistakes} />
      <TextVersions analysis={analysis} onSwitch={() => setSelected(null)}>
        <AnnotatedText text={analysis.input_text} placed={placed} selectedId={selected?.id ?? null} panelId={panelId} onSelect={open} />
      </TextVersions>
      {selected && <MistakePanel id={panelId} mistake={selected} onClose={close} />}
```
(import `TextVersions`; remove the now-unused `Button` import if nothing else uses it).

- [ ] **Step 4: Legend tooltips**

`frontend/src/features/feedback/labels.ts` — append:
```ts
export const KIND_HINTS: Record<MistakeKind, string> = {
  error: 'A grammar or spelling mistake. Errors count towards your errors per 100 words.',
  suggestion: 'Correct, but a native speaker would put it differently. Not counted as an error.',
  vocab_help: 'The word you were looking for, from your [brackets]. Not counted as an error.',
}
```

`frontend/src/features/feedback/Legend.tsx`:
```tsx
import { Tooltip, type TooltipAlign } from '@/components/ui/Tooltip'
import type { MistakeKind, MistakeOut } from '@/types/analysis'
import { KIND_HINTS, KIND_LABELS } from './labels'
import { markClasses } from './markClasses'

const KINDS: MistakeKind[] = ['error', 'suggestion', 'vocab_help']
// The first chip's tip opens rightwards and the last leftwards, so none overflows a 375px screen.
const ALIGN: Record<MistakeKind, TooltipAlign> = { error: 'start', suggestion: 'center', vocab_help: 'end' }

export interface LegendProps {
  mistakes: readonly MistakeOut[]
}

export function Legend({ mistakes }: LegendProps) {
  return (
    <ul aria-label="Feedback legend" className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
      {KINDS.map((kind) => (
        <li key={kind} className="flex items-center gap-1">
          <Tooltip content={KIND_HINTS[kind]} align={ALIGN[kind]}>
            <span className={markClasses[kind]}>{KIND_LABELS[kind]}</span>
          </Tooltip>{' '}
          <span className="font-semibold tabular-nums">{mistakes.filter((mistake) => mistake.kind === kind).length}</span>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 5: Toasts for analyses that finish out of sight**

`frontend/src/hooks/mutations/useRunAnalysisMutation.ts`:
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { journalKeys } from '@/hooks/queries/journalKeys'
import type { AnalysisOut } from '@/types/analysis'
import type { EntryDetailOut } from '@/types/entry'
import { client } from '@/utils/client'
import { ENDPOINTS } from '@/utils/endpoints'

export interface AnalysisCallbacks {
  onAnalysed?: (analysis: AnalysisOut) => void
  onFailed?: (error: Error) => void
}

// A failed model call still resolves (201, status "failed"); only transport errors reject.
// Callbacks are hook-level, not mutate-level: TanStack runs them even after the caller unmounted.
export function useRunAnalysisMutation(callbacks: AnalysisCallbacks = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (entryId: string) => client.post(ENDPOINTS.analyses(entryId)).json<AnalysisOut>(),
    onSuccess: async (analysis) => {
      …existing cache writes and invalidations unchanged…
      callbacks.onAnalysed?.(analysis)
    },
    onError: (error) => callbacks.onFailed?.(error),
  })
}
```

`frontend/src/features/write/useWriteSession.ts`:
```ts
import type { AnalysisCallbacks } from '@/hooks/mutations/useRunAnalysisMutation'
…
export function useWriteSession(onSaved: () => void, callbacks: AnalysisCallbacks = {}) {
  …
  const analyze = useRunAnalysisMutation(callbacks)
  // A second instance so "retrying" is just its pending state, not a flag kept beside the first.
  const reanalyze = useRunAnalysisMutation(callbacks)
```

`frontend/src/features/write/useBackgroundToasts.ts`:
```ts
import { useEffect, useMemo, useRef } from 'react'
import { useToast } from '@/components/ui/Toast'
import type { AnalysisCallbacks } from '@/hooks/mutations/useRunAnalysisMutation'
import type { AnalysisOut } from '@/types/analysis'

const READY = { message: 'Feedback is ready for the entry you just wrote — it is at the top of your entries.', tone: 'success' } as const
const FAILED = { message: 'The analysis of your new entry did not finish. It is saved — open it from your entries to retry.', tone: 'danger' } as const

// While the composer is on screen its status line and feedback say everything; a toast would repeat it. Once the
// learner opens another entry the composer unmounts, and only a toast can tell them how the analysis ended.
export function useBackgroundToasts(): AnalysisCallbacks {
  const { show } = useToast()
  const onScreen = useRef(true)
  useEffect(() => {
    onScreen.current = true
    return () => {
      onScreen.current = false
    }
  }, [])
  return useMemo(
    () => ({
      onAnalysed: (analysis: AnalysisOut) => {
        if (!onScreen.current) show(analysis.status === 'succeeded' ? READY : FAILED)
      },
      onFailed: () => {
        if (!onScreen.current) show(FAILED)
      },
    }),
    [show],
  )
}
```

`frontend/src/features/write/WriteScreen.tsx`:
```tsx
  const draft = useDraft()
  const session = useWriteSession(draft.clearText, useBackgroundToasts())
```
(import `useBackgroundToasts`).

- [ ] **Step 6: Update the write journey**

`frontend/e2e/write.spec.ts`, first test — replace the toggle steps:
```ts
  const corrected = mainColumn(page).getByRole('tab', { name: 'Corrected' })
  await corrected.click()
  await expect(corrected).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('Ayer yo soy feliz en el parque.')).toBeVisible()
  await expectHealthy(page)
```

- [ ] **Step 7: Run the frontend gate**

Run: `pnpm -C frontend verify`
Expected: `ALL GATES GREEN`.

- [ ] **Step 8: Commit**

```bash
git add frontend/src frontend/e2e/write.spec.ts
git commit -m "feat(frontend): corrected/original tabs, legend tooltips and toasts for analyses finished out of sight"
```

---
### Task 10: `[English]` chips while typing — `HighlightedTextarea`

Spec §7.1. The editor stays a native `<textarea>` (IME, undo, spellcheck, screen readers untouched). Behind it an `aria-hidden` backdrop with the same box, font and wrapping renders the text; the textarea's own text is transparent with a visible caret. Closed `[word]` spans are drawn as chips: a `primary-soft` tint plus a spread-only shadow, no padding and no font change, so glyph positions never drift. The component takes generic `decorations`, so P7 feeds it hint underlines through the same prop.

**Files:**
- Create: `frontend/src/components/ui/HighlightedTextarea/{HighlightedTextarea.tsx,decorate.ts,decorate.test.ts,HighlightedTextarea.test.tsx,index.ts}`
- Modify: `frontend/src/utils/{text.ts,text.test.ts}`, `frontend/src/features/editor/EntryTextField.tsx`, `frontend/DESIGN.md`, `frontend/e2e/write.spec.ts`

**Interfaces:**
- Consumes: `Textarea` (Task 1), `shadow-chip` token (Task 1).
- Produces (P7 depends on these exact names):
  - `Decoration = { start: number; end: number; className: string }` — **UTF-16 indices into the textarea value** (what `selectionStart` reports). Code-point offsets from the API are converted by the caller.
  - `decorate(text: string, decorations: readonly Decoration[]): DecoratedSegment[]`, `DecoratedSegment = { text: string; className: string | null }` — sorted, non-overlapping; overlapping, empty or out-of-range decorations are skipped, so the backdrop text always equals the textarea text.
  - `HighlightedTextarea(props: ComponentProps<'textarea'> & { value: string; decorations: readonly Decoration[] })` — wrapper owns border/background (`bg-surface` when `readOnly`); `ref`, `onScroll` and every native prop reach the textarea; backdrop `scrollTop` follows the textarea.
  - `CHIP_CLASS = 'rounded-sm bg-primary-soft shadow-chip'`.
  - `bracketRanges(text: string): { start: number; end: number }[]` in `utils/text.ts` — closed `[…]` without nested brackets or newlines.

- [ ] **Step 1: Write the failing tests**

`frontend/src/components/ui/HighlightedTextarea/decorate.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { decorate } from './decorate'

const chip = (start: number, end: number) => ({ start, end, className: 'chip' })

describe('decorate', () => {
  it.each([
    ['plain text', 'Hola', [], [{ text: 'Hola', className: null }]],
    ['one span', 'en el [park].', [chip(6, 12)], [{ text: 'en el ', className: null }, { text: '[park]', className: 'chip' }, { text: '.', className: null }]],
    ['adjacent spans, given out of order', 'abcd', [chip(2, 4), chip(0, 2)], [{ text: 'ab', className: 'chip' }, { text: 'cd', className: 'chip' }]],
    ['an overlap: the later one is skipped', 'abcdef', [chip(0, 4), chip(2, 6)], [{ text: 'abcd', className: 'chip' }, { text: 'ef', className: null }]],
    ['out of range or empty spans', 'abc', [chip(1, 9), chip(2, 2)], [{ text: 'abc', className: null }]],
    ['empty text', '', [chip(0, 1)], []],
  ])('handles %s', (_label, text, decorations, expected) => {
    // Arrange + Act
    const segments = decorate(text, decorations)
    // Assert
    expect(segments).toEqual(expected)
    expect(segments.map((segment) => segment.text).join('')).toBe(text)
  })
})
```

`frontend/src/components/ui/HighlightedTextarea/HighlightedTextarea.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { CHIP_CLASS, HighlightedTextarea } from '.'

function Harness({ initial = 'en el [park].', readOnly = false }: { initial?: string; readOnly?: boolean }) {
  const [value, setValue] = useState(initial)
  return <HighlightedTextarea aria-label="Your entry" value={value} readOnly={readOnly} onChange={(event) => setValue(event.target.value)} decorations={[{ start: 6, end: 12, className: CHIP_CLASS }]} />
}

// The backdrop is aria-hidden by design (the textarea is the accessible control), so it is reached through the DOM.
const backdrop = (container: HTMLElement) => container.querySelector<HTMLElement>('[aria-hidden="true"]')

describe('HighlightedTextarea', () => {
  it('keeps the native textarea as the labelled, editable control', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<Harness initial="" />)
    // Act
    await user.type(screen.getByRole('textbox', { name: 'Your entry' }), 'Hola')
    // Assert
    expect(screen.getByRole('textbox', { name: 'Your entry' })).toHaveValue('Hola')
  })

  it('mirrors the text behind it and draws decorated ranges as chips', () => {
    // Arrange + Act
    const { container } = render(<Harness />)
    // Assert
    expect(backdrop(container)).toHaveTextContent('en el [park].')
    const marks = container.querySelectorAll('mark')
    expect(marks).toHaveLength(1)
    expect(marks[0]).toHaveTextContent('[park]')
    expect(marks[0]).toHaveClass('bg-primary-soft', 'shadow-chip')
  })

  it('scrolls the backdrop with the textarea', () => {
    // Arrange
    const { container } = render(<Harness />)
    const textarea = screen.getByRole('textbox')
    textarea.scrollTop = 40
    // Act — user-event has no scroll API.
    fireEvent.scroll(textarea)
    // Assert
    expect(backdrop(container)?.scrollTop).toBe(40)
  })

  it('tints its frame while read-only', () => {
    // Arrange + Act
    const { container } = render(<Harness readOnly />)
    // Assert
    expect(container.firstChild).toHaveClass('bg-surface')
    expect(screen.getByRole('textbox')).toHaveAttribute('readonly')
  })
})
```

Append to `frontend/src/utils/text.test.ts`:
```ts
describe('bracketRanges', () => {
  it.each([
    ['one closed bracket', 'en el [park].', [{ start: 6, end: 12 }]],
    ['two', '[a] y [b c]', [{ start: 0, end: 3 }, { start: 6, end: 11 }]],
    ['an unclosed bracket', 'en el [par', []],
    ['empty brackets', 'x [] y', []],
    ['a bracket across lines', '[par\nk]', []],
    ['nested brackets: only the inner pair', '[a [b] c]', [{ start: 3, end: 6 }]],
  ])('finds %s', (_label, text, expected) => {
    // Arrange + Act
    const ranges = bracketRanges(text)
    // Assert
    expect(ranges).toEqual(expected)
  })
})
```
(add `bracketRanges` to the import from `./text`).

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm -C frontend exec vitest run src/components/ui/HighlightedTextarea src/utils/text.test.ts`
Expected: FAIL — modules and `bracketRanges` not found.

- [ ] **Step 3: Implement**

`frontend/src/utils/text.ts` — append:
```ts
// Closed `[English]` fallbacks only (spec §7.1): the chip appears once the closing bracket is typed. UTF-16 indices,
// because they decorate the textarea value directly.
export function bracketRanges(text: string): { start: number; end: number }[] {
  return Array.from(text.matchAll(/\[[^[\]\n]+\]/gu), (match) => ({ start: match.index, end: match.index + match[0].length }))
}
```

`frontend/src/components/ui/HighlightedTextarea/decorate.ts`:
```ts
export interface Decoration {
  start: number
  end: number
  className: string
}

export interface DecoratedSegment {
  text: string
  className: string | null
}

// UTF-16 indices into the textarea value. Overlapping, empty or out-of-range decorations are skipped: the backdrop
// must render exactly the textarea's text, or the visible text drifts away from the caret.
export function decorate(text: string, decorations: readonly Decoration[]): DecoratedSegment[] {
  const segments: DecoratedSegment[] = []
  let cursor = 0
  for (const decoration of [...decorations].sort((a, b) => a.start - b.start)) {
    const { start, end, className } = decoration
    if (start < cursor || end <= start || end > text.length) continue
    if (start > cursor) segments.push({ text: text.slice(cursor, start), className: null })
    segments.push({ text: text.slice(start, end), className })
    cursor = end
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), className: null })
  return segments
}
```

`frontend/src/components/ui/HighlightedTextarea/HighlightedTextarea.tsx`:
```tsx
import { useRef, type ComponentProps, type UIEvent } from 'react'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/utils/utils'
import { decorate, type Decoration } from './decorate'

export type { Decoration } from './decorate'

export interface HighlightedTextareaProps extends ComponentProps<'textarea'> {
  value: string
  decorations: readonly Decoration[]
}

// Tint plus a spread-only shadow: no padding, border or font change, so the chip never moves a glyph.
export const CHIP_CLASS = 'rounded-sm bg-primary-soft shadow-chip'

// Both layers share box, font, wrapping and a permanent scrollbar gutter, so line breaks always match.
const layerClass = 'min-h-48 w-full overflow-y-scroll rounded-lg border border-transparent p-4 text-base leading-relaxed whitespace-pre-wrap wrap-break-word'

export function HighlightedTextarea({ value, decorations, className, onScroll, readOnly, ...rest }: HighlightedTextareaProps) {
  const backdropRef = useRef<HTMLDivElement>(null)
  const syncScroll = (event: UIEvent<HTMLTextAreaElement>) => {
    if (backdropRef.current) backdropRef.current.scrollTop = event.currentTarget.scrollTop
    onScroll?.(event)
  }
  return (
    <div className={cn('relative rounded-lg border border-border-input bg-bg shadow-sm', readOnly && 'bg-surface')}>
      <div ref={backdropRef} aria-hidden="true" className={cn(layerClass, 'pointer-events-none absolute inset-0 text-fg')}>
        {decorate(value, decorations).map((segment, index) =>
          segment.className ? (
            <mark key={index} className={cn('text-fg', segment.className)}>
              {segment.text}
            </mark>
          ) : (
            <span key={index}>{segment.text}</span>
          ),
        )}
        {/* A trailing newline collapses in a div but not in a textarea; the space gives that last line its height. */}{' '}
      </div>
      <Textarea
        value={value}
        readOnly={readOnly}
        onScroll={syncScroll}
        className={cn(layerClass, 'relative block resize-y bg-transparent text-transparent caret-fg shadow-none selection:bg-primary/25 read-only:bg-transparent', className)}
        {...rest}
      />
    </div>
  )
}
```
`index.ts`:
```ts
export * from './decorate'
export * from './HighlightedTextarea'
```
(`ref` arrives in `...rest` and lands on the native textarea through `Textarea`.)

`frontend/src/features/editor/EntryTextField.tsx` — swap the control (drop the `Textarea` import):
```tsx
import { CHIP_CLASS, HighlightedTextarea } from '@/components/ui/HighlightedTextarea'
import { bracketRanges, countWords, entryLength } from '@/utils/text'
…
  const chips = bracketRanges(value).map((range) => ({ ...range, className: CHIP_CLASS }))
  …
      <HighlightedTextarea
        id={id}
        ref={textareaRef}
        value={value}
        decorations={chips}
        readOnly={readOnly}
        aria-describedby={over > 0 ? `${hintId} ${countId} ${overId}` : `${hintId} ${countId}`}
        aria-invalid={over > 0}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
```

`frontend/DESIGN.md` — add:
```markdown
| `HighlightedTextarea` | — | native `textarea` over an `aria-hidden` mirrored backdrop; `decorations` (UTF-16 ranges + token classes) draw chips/underlines without moving glyphs; `CHIP_CLASS` for `[word]` chips |
```

- [ ] **Step 4: Run the unit tests**

Run: `pnpm -C frontend exec vitest run`
Expected: PASS (all Write/Revise tests still find "Your entry" / "Revise your entry" as textboxes).

- [ ] **Step 5: Add the chip journey**

Append to `frontend/e2e/write.spec.ts`:
```ts
test('a bracketed English word becomes a chip as soon as the bracket closes', async ({ page }) => {
  // Arrange
  await page.goto('/')
  const editor = page.getByLabel('Your entry')
  // Act
  await editor.fill('Quiero ir al [park')
  await expect(mainColumn(page).locator('mark')).toHaveCount(0)
  await editor.press(']')
  // Assert — the backdrop is aria-hidden, so the chip is reached by its element.
  await expect(mainColumn(page).locator('mark')).toHaveText('[park]')
  const sameBox = await page.evaluate(() => {
    const textarea = document.querySelector('main textarea')
    const layer = textarea?.previousElementSibling
    return textarea && layer ? textarea.clientWidth === layer.clientWidth : false
  })
  expect(sameBox).toBe(true)
  await expectHealthy(page)
})
```

- [ ] **Step 6: Run the frontend gate**

Run: `pnpm -C frontend verify`
Expected: `ALL GATES GREEN`. axe treats fully transparent text as "needs review" (incomplete), not a violation. If it does report a serious `color-contrast` violation on the textarea, stop and report the axe output to the controller (the visible text is the backdrop's `text-fg`, 15.57:1, so this would be a tooling false positive needing a decision) — never exclude the rule or the element.

- [ ] **Step 7: Commit**

```bash
git add frontend/src frontend/DESIGN.md frontend/e2e/write.spec.ts
git commit -m "feat(frontend): bracketed English words render as chips while typing"
```

---

### Task 11: Workspace e2e sweep, full-stack journeys and the Lighthouse check

**Files:**
- Create: `frontend/e2e/workspace.spec.ts`
- Modify: `frontend/e2e-stack/{journal.spec.ts,insights.spec.ts}`; only if Step 5 fails: `frontend/src/features/workspace/Workspace.tsx`

**Interfaces:**
- Consumes: everything above; `e2e/workspace.ts` helpers.
- Produces: cross-cutting journeys (Back/Forward, 375px fit, reduced motion, keyboard-only sheet) and the six full-stack journeys on the workspace.

- [ ] **Step 1: Write the workspace spec**

`frontend/e2e/workspace.spec.ts`:
```ts
import { expect, test, type Page } from '@playwright/test'
import { expectNoA11yViolations } from './a11y'
import { expectButtonsShowPointer } from './cursor'
import { mainColumn, openEntries } from './workspace'

async function expectFitsWidth(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

const heading = (page: Page, name: string) => mainColumn(page).getByRole('heading', { level: 1, name })

test('Back and Forward walk between the composer and entries without leaving the workspace', async ({ page }) => {
  // Arrange
  await page.goto('/')
  const entries = await openEntries(page)
  await entries.getByRole('link', { name: /Je suis allé au marché/ }).click()
  await expect(heading(page, 'Entry')).toBeVisible()
  // Act
  await page.goBack()
  // Assert
  await expect(heading(page, 'Write')).toBeVisible()
  await expect(page).toHaveURL('/')
  await page.goForward()
  await expect(heading(page, 'Entry')).toBeVisible()
})

test('every surface fits a 375px screen', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  await expectFitsWidth(page)
  // Act + Assert
  const entries = await openEntries(page)
  await expect(entries.getByRole('list', { name: 'Entries' })).toBeVisible()
  await expectFitsWidth(page)
  await entries.getByRole('link', { name: /Hoy 😀 la problema/ }).click()
  await expect(heading(page, 'Entry')).toBeVisible()
  await expectFitsWidth(page)
  await page.getByRole('button', { name: 'Insights', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Insights' }).getByRole('region', { name: 'Summary' })).toBeVisible()
  await expectFitsWidth(page)
  await expectNoA11yViolations(page)
})

test('sheets appear without sliding when the user prefers reduced motion', async ({ page }) => {
  // Arrange
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  // Act
  await page.getByRole('button', { name: 'Insights', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Insights' })
  await expect(dialog).toBeVisible()
  // Assert
  expect(await dialog.evaluate((element) => getComputedStyle(element).transform)).toBe('none')
})

test('the insights sheet works from the keyboard alone', async ({ page }) => {
  // Arrange
  await page.goto('/')
  const opener = page.getByRole('button', { name: 'Insights', exact: true })
  await opener.focus()
  // Act
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Insights' })
  // Assert
  await expect(dialog.getByRole('heading', { level: 2, name: 'Insights' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(dialog.locator(':focus')).toHaveCount(1)
  await expectButtonsShowPointer(page)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(opener).toBeFocused()
})
```

- [ ] **Step 2: Run it**

Run: `pnpm -C frontend exec playwright test e2e/workspace.spec.ts`
Expected: `8 passed` (4 tests × desktop + mobile). If a journey fails, fix the product code — failing test first in Vitest where the cause is unit-testable — never the assertion.

- [ ] **Step 3: Rewrite the full-stack journeys**

`frontend/e2e-stack/journal.spec.ts`:
```ts
import { expect, test } from '@playwright/test'
import { expectNoA11yViolations } from '../e2e/a11y'
import { expectButtonsShowPointer } from '../e2e/cursor'
import { composerLanguage, mainColumn, openEntries } from '../e2e/workspace'

const DEMO_SUMMARY = 'Demo feedback — configure Claude for real corrections.'

test('the real stack saves an entry, returns demo feedback and lists it in the sidebar', async ({ page }, testInfo) => {
  // Arrange — a unique entry per run and project, because the stack's database outlives one test.
  const text = `Ayer yo es feliz en el [park]. (${testInfo.project.name} ${Date.now()})`
  await page.goto('/')
  await expect(page).toHaveTitle('Write · Language Journal')
  await composerLanguage(page).selectOption('es')
  await page.getByLabel('Your entry').fill(text)
  // Act
  await mainColumn(page).getByRole('button', { name: 'Get feedback' }).click()
  // Assert
  const main = mainColumn(page)
  await expect(main.getByText(DEMO_SUMMARY)).toBeVisible()
  await main.getByRole('button', { name: /yo es/ }).click()
  await expect(main.getByRole('region', { name: /should be yo soy/ })).toContainText('Verb conjugation')
  await expectNoA11yViolations(page)
  await expectButtonsShowPointer(page)
  const entries = await openEntries(page)
  const row = entries.getByRole('listitem').filter({ hasText: text })
  await expect(row).toContainText('1 error')
  await row.getByRole('link').click()
  await expect(main.getByRole('heading', { level: 1, name: 'Entry' })).toBeVisible()
  await expect(main.getByText(DEMO_SUMMARY)).toBeVisible()
  await expectNoA11yViolations(page)
})

test('the real stack keeps a revision and the analysis it replaced', async ({ page }, testInfo) => {
  // Arrange — unique per run and project, like the first journey.
  const tag = `(${testInfo.project.name} ${Date.now()})`
  const original = `Ayer yo es feliz. ${tag}`
  const revised = `Hoy la problema es grande. ${tag}`
  const main = mainColumn(page)
  await page.goto('/')
  await composerLanguage(page).selectOption('es')
  await page.getByLabel('Your entry').fill(original)
  await main.getByRole('button', { name: 'Get feedback' }).click()
  await expect(main.getByRole('button', { name: /yo es/ })).toBeVisible()
  // Act
  await main.getByRole('button', { name: 'Revise & re-check' }).click()
  await page.getByLabel('Revise your entry').fill(revised)
  await main.getByRole('button', { name: 'Re-check', exact: true }).click()
  await expect(main.getByRole('button', { name: /la problema/ })).toBeVisible()
  await page.reload()
  const entries = await openEntries(page)
  await entries.getByRole('listitem').filter({ hasText: tag }).getByRole('link').click()
  // Assert
  await expect(main.getByRole('button', { name: /la problema/ })).toBeVisible()
  const options = main.getByLabel('Analysis').getByRole('option')
  await expect(options).toHaveCount(2)
  await expect(options.first()).toContainText('(latest)')
  await expect(options.last()).not.toContainText('(latest)')
  await expectNoA11yViolations(page)
  await main.getByLabel('Analysis').selectOption({ index: 1 })
  await expect(main.getByRole('button', { name: /yo es/ })).toBeVisible()
  await expect(main.getByRole('region', { name: 'Feedback' })).toContainText(original)
  await expectNoA11yViolations(page)
  await expectButtonsShowPointer(page)
})
```

`frontend/e2e-stack/insights.spec.ts` — keep `ENTRIES`, `InsightsBody`, `writeAnalysed` and the Arrange block; replace from `// Act` to the end of the test:
```ts
  // Act
  await page.goto('/?insights=1')
  const insights = page.getByRole('dialog', { name: 'Insights' })
  await insights.getByLabel('Filter by language').selectOption(language)
  // Assert
  const summary = insights.getByRole('region', { name: 'Summary' })
  for (const sentence of expected.summary) await expect(summary).toContainText(sentence)
  await expect(insights.getByRole('img', { name: new RegExp(`across ${expected.entry_count} entries`) })).toBeVisible()
  const verbs = insights.getByRole('row', { name: /Verb conjugation/ })
  await expect(verbs).toContainText(/Recurring · \d of last \d/)
  await expect(verbs).toContainText('yo es')
  await expect(verbs).toContainText('yo soy')
  await expect(insights.getByRole('row', { name: /Gender agreement/ })).toContainText('el problema')
  await expectNoA11yViolations(page)
  await expectButtonsShowPointer(page)
})
```

- [ ] **Step 4: Run the full-stack smoke**

Run: `make e2e-stack`
Expected: `6 passed` (3 journeys × desktop + mobile).

- [ ] **Step 5: Lighthouse and bundle check**

Run: `pnpm -C frontend lighthouse`
Expected: `✔ desktop performance 100` … `✔ mobile performance ≥ 90`, `Lighthouse gate green`. Then `ls -l frontend/dist/assets/*.js` — the entry chunk must not contain the `domAnimation` features: there is a separate `motionFeatures-*.js` chunk.

If mobile performance is below 90 (do not touch the bar): code-split the insights sheet, which carries the chart, the table and the summary code that the first paint never needs. In `frontend/src/features/workspace/Workspace.tsx`:
```tsx
import { lazy, Suspense, useState } from 'react'
…
// Insights code (chart, table) is only needed once the sheet opens; keeping it out of the entry chunk protects mobile LCP.
const InsightsSheet = lazy(() => import('./InsightsSheet').then((module) => ({ default: module.InsightsSheet })))
…
      {insightsOpen && (
        <Suspense fallback={null}>
          <InsightsSheet />
        </Suspense>
      )}
```
(remove the static `InsightsSheet` import). Re-run `pnpm -C frontend exec vitest run src/features/workspace` (the insights tests `findBy…` the lazy dialog) and `pnpm -C frontend lighthouse`. Record both scores in the commit body.

- [ ] **Step 6: Run the frontend gate**

Run: `pnpm -C frontend verify`
Expected: `ALL GATES GREEN`.

- [ ] **Step 7: Commit**

```bash
git add frontend/e2e/workspace.spec.ts frontend/e2e-stack frontend/src/features/workspace
git commit -m "test(frontend): workspace journeys (history, 375px, reduced motion, keyboard) and full-stack smoke on the workspace"
```

---

### Task 12: Docs and phase checkpoint

**Files:**
- Modify: `README.md`, `docs/loom-outline.md`, `frontend/CLAUDE.md`, `docs/superpowers/specs/2026-10-10-ai-language-journal-design.md` (§7), `docs/superpowers/plans/2026-10-10-00-index.md`; any file a BLOCKING finding names.
- Create: `docs/qa/p6-*.png` (ui-qa screenshots).

**Interfaces:**
- Consumes: everything above.
- Produces: P6 marked done with evidence.

- [ ] **Step 1: ui-qa**

Dispatch the `ui-qa` agent (it builds `--mode mock` and serves `http://localhost:4173`) at 1280×800 and 375×812, keyboard pass included, screenshots `docs/qa/p6-<n>-<name>-{desktop,mobile}.png`, plus `docs/qa/p6-workspace-desktop.png` and `docs/qa/p6-workspace-mobile.png` for the README. `?mock=` modes apply only to the URL they are loaded on.
1. Header: brand, language badge ("All languages" / the filter's language), "Insights" button; gradient band behind the header only; first Tab shows "Skip to content".
2. Desktop sidebar: "New entry", "Filter by language", rows with preview, date · language and a status badge, the open entry highlighted (`aria-current`), "Load more", Progress card (sparkline + trend, or "n more entries to see trends"), "Open insights".
3. Phone: "Entries" opens a left sheet with the same sidebar; picking an entry closes it and focus lands on the entry heading; no horizontal scroll on any surface.
4. Composer: language select, editor with live counts; typing `[park]` shows a chip once `]` is typed and the caret and text stay aligned (type, select, scroll a long entry); "Get feedback" and ⌘/Ctrl+Enter; "Saved. Analyzing…" → feedback inline.
5. Feedback: highlights, panel (Esc returns focus), "Your text" / "Corrected" tabs (arrow keys move), legend tooltips on focus and hover (Esc closes), "Revise & re-check", "New entry".
6. Entry in place: selecting a row swaps only the main column; the analysis switcher works; going back to "New entry" keeps a draft that was being typed.
7. Insights sheet: right on desktop, bottom on phones; focus on its heading; Esc, scrim and Close dismiss and focus returns to the opener; browser Back closes it; its filter and the sidebar filter move together.
8. URLs: `/?entry=<id>`, `/?insights=1`, `/?language=es` deep-link; `/entries`, `/entries/<id>`, `/insights` redirect into the workspace; `/?entry=not-an-id` shows "Entry not found" with "Write a new entry".
9. Toast: submit an entry on `/?mock=slow`, open another entry while it analyses — "Feedback is ready…" appears and can be dismissed.
10. States: `/?mock=slow` skeletons in sidebar, entry and insights; `/?mock=error` one retry per region; `/?mock=empty` empty sidebar with "Write your first entry".
11. Everywhere: reduced motion (emulated) → sheets and tabs do not slide; `prefers-color-scheme: dark` legible (marks, chips, badges); focus always visible; no console errors outside `?mock=error`.

- [ ] **Step 2: Reviewer**

Dispatch the `reviewer` agent on the P6 commit range (Task 1 through Task 11) with this plan, the P6 design and the main spec. Fix every BLOCKING finding — failing test first, `make verify` green — one commit per fix (`fix(frontend): <finding>`), then re-run the affected ui-qa criteria. Record SHOULD findings in the index row.

- [ ] **Step 3: Docs**

`README.md`:
- Replace the two screenshot tables at the top with:
  ```markdown
  | Workspace (desktop) | Workspace (phone) |
  |---|---|
  | ![Workspace with entries, composer and feedback](docs/qa/p6-workspace-desktop.png) | ![Workspace on a phone](docs/qa/p6-workspace-mobile.png) |
  ```
- After "## How it works", add:
  ```markdown
  ## The workspace (frontend)

  One screen, no page changes. The sidebar lists entries (language filter, "Load more", a progress sparkline);
  the main column is either the composer or the selected entry; insights open as a sheet over both. The URL holds
  the state — `?entry=<id>`, `?insights=1`, `?language=es` — so links are shareable and Back works; old links
  (`/entries/<id>`, `/insights`) redirect. On phones the sidebar is a left sheet and insights a bottom sheet.
  Bracketed English words become chips while typing (a mirrored layer behind a native textarea, so IME, undo and
  screen readers are untouched). Visual language: `DESIGN.md`; motion primitives adapted from SmoothUI (MIT).
  ```
- "Tech choices": `| React Router | Three routes with URL-held filters (?language=) |` → `| React Router | URL search params are the workspace state (entry, insights, language); old routes redirect |`; `| React 19 + Vite SPA | Three screens, one user, …` → `| React 19 + Vite SPA | One workspace screen, one user, no SEO — SSR would add a server for nothing |`; add `| motion (LazyMotion + domAnimation) | Sheet, tab and toast motion ported from SmoothUI; ~5 kB up front, features lazy-loaded, off under reduced motion |`.
- "Testing" table: Frontend units/components count `⟨FILL: Vitest total⟩`, e2e count `⟨FILL: Playwright total⟩`, Full stack `6`, Lighthouse `desktop 100, mobile ⟨FILL: mobile score⟩`; replace each marker with the number from Step 5's output.

`docs/loom-outline.md` — replace rows 0:30–4:15 with:
```markdown
| 0:30–2:00 | Write → feedback | The workspace; type a Spanish entry with `[to travel]` (chip appears); ⌘/Ctrl+Enter | One screen. Saved first, analysed second; highlights in my text; panel; the bracket became `vocab_help`; "Your text / Corrected" tabs. |
| 2:00–2:30 | Failure | `/?mock=analysis-fail` on the mock build | The entry is kept, the failed analysis is a stored resource, "Retry analysis" runs it again. |
| 2:30–3:00 | Revise + history | "Revise & re-check"; pick an older entry in the sidebar | The main column swaps in place; the switcher keeps every analysis; my draft is still there when I come back. |
| 3:00–3:30 | URL as state | Copy `/?entry=…`, Back/Forward, open on a phone width | Selection, sheet and filter live in the URL; phones get sheets, not pages. |
| 3:30–4:15 | Insights | Progress card → "Open insights", choose Spanish | Errors per 100 words over time, earlier vs recent per category, recurring badge — in a sheet over the workspace. |
```
and add to "Deep-dive Q&A": **Why one screen instead of routes?** Every context switch was a page change; with the URL as the only state owner, the workspace keeps shareable links and Back while removing navigation. **Why port SmoothUI by hand instead of the shadcn CLI?** One token system, no Radix/vaul/CVA, file-size and a11y rules; `motion` is the only new dependency.

`frontend/CLAUDE.md` — under "## Layout", add:
```markdown
- `features/workspace/` — the single screen: `Workspace` (header, sidebar or entries sheet, main column, insights sheet). Workspace state lives only in the URL via `hooks/misc/useWorkspaceParams` (`entry`, `insights`, `language`); never mirror it in state.
- Sheets (`components/ui/Sheet`) are modal dialogs: heading focused on open, focus restored on close unless the user moved on. Animations use `m.*` from `motion/react` only (LazyMotion strict) and honour `useReducedMotion`.
```

Main spec `docs/superpowers/specs/2026-10-10-ai-language-journal-design.md` §7 — prepend: `> Amended by P6 (\`2026-10-11-p6-workspace-redesign.md\`): one workspace screen on \`/\`; History, Entry detail and Insights live in its sidebar, main column and insights sheet; URL search params hold the state; old routes redirect.`

- [ ] **Step 4: Full gate**

Run: `make verify` then `make e2e-stack`
Expected: `ALL GATES GREEN`, then `6 passed`. Run `grep -n "⟨FILL" README.md` — expected: no output.

- [ ] **Step 5: Mark P6 done**

In `docs/superpowers/plans/2026-10-10-00-index.md`, replace the P6 row with (numbers from Step 4's output):
```markdown
| P6 Single-screen workspace + visual redesign | `2026-10-11-p6-workspace.md` | done (⟨Vitest⟩ Vitest, ⟨Playwright⟩ Playwright + axe, Lighthouse 100/⟨mobile⟩, full-stack 6/6, ui-qa 11/11) |
```

```bash
git add README.md docs/loom-outline.md frontend/CLAUDE.md docs/superpowers/specs/2026-10-10-ai-language-journal-design.md docs/superpowers/plans/2026-10-10-00-index.md docs/qa
git commit -m "docs: P6 workspace done"
```
Paste the `make verify` tail, the `make e2e-stack` result, the ui-qa table and the reviewer verdict into the phase report.

---

## Self-review notes

- Spec coverage: §2 one screen + layout (T5), URL as state with one owner (T4, T5, T6), old routes redirect with query kept (T5, T6), selecting swaps the main column with `aria-current` and the draft kept (T5), "New entry" clears and focuses (T5), progress card with ≤10-point sparkline and "n more entries" (T7), phones: left sheet + bottom insights sheet + no horizontal scroll (T6, T8, T11), keyboard: ⌘/Ctrl+Enter unchanged, sheets trap/restore/Esc, entry and sheet headings take focus (T2, T5, T6). §3 DESIGN.md + tokens light/dark + AA (T1). §4 AnimatedTabs (T3, T9), Sheet (T2), Skeleton (T3, T7), Toast (T3, T9), Tooltip (T3, T9), attribution line, `motion` via LazyMotion/domAnimation/`m`, no lucide/Radix/CVA/vaul (T2, T3). §5 gates unchanged, e2e journeys rewritten, full-stack 6 journeys, ui-qa at both sizes (T5–T12). §6 out of scope respected (no palette, resize, delete, offline, theme toggle). §7.1 chips (T10); §7.2 is P7.
- Deviations, each with its reason in the task: muted and input-border colours darkened for AA (T1); AnimatedTabs indicator by transform instead of `layoutId` (domMax weight, T3); Sheet keeps SmoothUI's motion but not vaul, the handle pulse or the stagger (T2); no "saved" toast (double announcement, T9); bottom sheet uses `top-12` instead of `90vh` (no arbitrary values; ≈ 90% at 812px); inline retry kept in sidebar rows (keeps the P3 criterion); day-group headings from the sketch not built — each row shows its date, keeping one list for screen readers and the existing tests; document title follows the main column, not the insights layer; e2e spread over tasks so `make verify` stays green per task.
- Placeholders: only the deliberate `⟨FILL: …⟩` / `⟨…⟩` markers for counts that must come from real runs (T12 Step 3–5 grep them out).
- Names across tasks: `useWorkspaceParams` (`entryId`, `insightsOpen`, `language`, `entryHref`, `selectEntry`, `openInsights`, `closeInsights`, `setLanguage`), `useChangedSinceMount`, `useMediaQuery(query, fallback)`, `DESKTOP_QUERY`, `LocationProbe`, `Sheet`/`SheetSide`, `Icon`/`IconName`, `AnimatedTabs`/`tabId`/`panelId`, `Skeleton`, `LoadingState` children, `ToastProvider`/`useToast`/`ToastInput`, `Tooltip`/`TooltipAlign`, `Card`, `HighlightedTextarea`/`Decoration`/`decorate`/`CHIP_CLASS`, `bracketRanges`, `Workspace`/`WorkspaceHeader`/`Sidebar`/`MainColumn`/`Composer`/`InsightsSheet`/`ProgressCard`/`ProgressSummary`/`ProgressLoading`/`Sparkline`/`LanguageStatus`/`useEntriesSheet`, `RateLines`, `TextVersions`, `KIND_HINTS`, `AnalysisCallbacks`, `useBackgroundToasts`, `openEntries`/`mainColumn`/`composerLanguage`.
- Verified while planning: `motion@14.1.0` exports (`LazyMotion`, `MotionConfig`, `AnimatePresence`, `m`, `useReducedMotion`, `domAnimation`, `domMax`) and its gz sizes from the tarball; motion guards `window.matchMedia` (safe in jsdom); `react-router` 8.4 exports `NavigationType` and `useNavigationType`; fallow treats test files as entry points; `EntryTextField` is the only `Textarea` user; seed numbers used in assertions (11 analysed entries, 7.6 per 100 words, fr = 3, de = 0, es ≥ 4).
- Not verified by running (no app or browser during planning): motion's first-render inline `transform` string (`translateX(100%)`) asserted in `Sheet.test`; `AnimatePresence` removing children immediately when no features are loaded (jsdom) — if a test sees a lingering dialog, wrap that test in `<LazyMotion features={domAnimation}>` rather than weakening it; axe on the transparent-text textarea (T10 Step 6 says what to do); Lighthouse mobile with the workspace's extra first-load requests (T11 Step 5 has the code-split fallback).

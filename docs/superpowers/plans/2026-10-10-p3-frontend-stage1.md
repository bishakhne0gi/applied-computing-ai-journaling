# P3 Frontend Stage 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Stage 1 UI — write an entry, get inline AI feedback (highlights, detail panel, corrected version, other notes), retry failures, revise and re-check, and browse past entries and analyses — backed by an in-memory MSW API in dev/tests and by the real stack in a full-stack Playwright smoke.

**Architecture:** One ky client and an `ENDPOINTS` map feed TanStack Query hooks (`hooks/queries`, `hooks/mutations`); the query cache is the only owner of server data. Features (`features/write`, `features/feedback`, `features/editor`, `features/history`, `features/entry-detail`, `features/languages`, `features/shell`) compose token-styled primitives from `components/ui`; pages are thin route shells under a React Router layout route. MSW implements the whole `/api/v1` contract in memory (demo data, `?mock=` modes) for `pnpm dev`, Vitest, Playwright and the Lighthouse mock build; a separate Playwright config drives the Compose stack with the fake AI provider.

**Tech Stack:** Vite 8, React 19, TypeScript 6 (strict), Tailwind v4 tokens, React Router 8.4.0 (declarative mode), TanStack Query 5.104.0, ky 2.1.0, MSW 2.15.0, Vitest 5 + Testing Library, Playwright 1.63 + axe, Lighthouse.

**Spec:** `docs/superpowers/specs/2026-10-10-ai-language-journal-design.md` (§2 product decisions, §5 API, §6 offsets, §7 frontend, §10 testing, §13 P3 exit). API response shapes are copied from `docs/superpowers/plans/2026-10-10-p2-backend-stage1.md` Task 4 (`EntryOut`, `EntryDetailOut`, `EntrySummaryOut`, `EntryPageOut`, `AnalysisOut`, `MistakeOut`, `LanguageOut`) and the problem+json body from `backend/app/core/errors.py`.

## Global Constraints

- P3 exit (spec §13): component tests + e2e + axe green. `make verify` (needs `make db`) — which ends with `pnpm verify`: types → lint → dupes/dead code → unit + coverage band → e2e + axe → Lighthouse 100s on the mock build of `/` — is green at the end of **every** task.
- Hard limits (eslint, never disabled): file ≤200 lines (tests included), function ≤60 lines, complexity ≤10 (ESLint 9 counts `?.`, `??`, `&&`, ternaries and default params), cognitive ≤12, max depth 3. Split, don't disable.
- Folder boundaries (eslint): `components/` is pure (no features/hooks/pages/providers, no client/endpoints); features reach data only through `hooks/queries` and `hooks/mutations`; pages are thin shells with no data hooks; `hooks/**` never imports features/components/pages; `hooks/misc` is data-free.
- Styling: tokens only — no arbitrary values, no palette classes, no `dark:`, no raw `z-*`, no inline `style`. Every button is `<Button>` from `@/components/ui/Button` (the only raw `<button>`) and shows `cursor-pointer` / `not-allowed`. Primitives live in `src/components/ui/<Name>/{<Name>.tsx,<Name>.test.tsx,index.ts}`, are imported via the folder index, and get a row in `frontend/DESIGN.md`.
- Server data lives only in the TanStack Query cache; counts, filters and labels are derived, never stored twice. The draft text and the last language are the only `localStorage` values.
- Offsets are Unicode code points (spec §6): text is sliced with `Array.from(text)`, never by UTF-16 index.
- API base `/api/v1/`, absolute from `location.origin`, overridable by `VITE_API_BASE`. MSW runs in `pnpm dev` unless `VITE_API_MOCKS=off` (then the Vite proxy forwards `/api` and `/health` to `http://localhost:8000`), always in `--mode mock`, never in a production build. Problem+json errors reach the user as human sentences (`toErrorMessage`).
- Every UI: loading, empty, error (with retry) and ready states · keyboard operable · visible focus · labelled controls · works at 375px and 1280px · `prefers-reduced-motion` (global rule in `global.css`) · touch targets ≥2.75rem (`min-h-11`) except inline text highlights.
- New dependencies, exact pins, each with a one-line reason here and in its commit body — nothing else:
  - `ky@2.1.0` — small fetch wrapper: timeouts, typed JSON, `HTTPError.data` carrying the parsed problem+json body.
  - `@tanstack/react-query@5.104.0` — the server-state cache: loading/error states, cursor paging, invalidation after writes.
  - `msw@2.15.0` (dev) — one in-memory implementation of the API for dev, Vitest, Playwright and the Lighthouse mock build.
  - `react-router@8.4.0` — three routes under one layout with the History filter kept in the URL; v8 is the current major (React ≥19.2.7, Node ≥22.22).
- Never log entry text or send it to Sentry; no `console.*` in app code. Never open or print the real env file.
- Tests: AAA comments, behaviour names, role queries, `userEvent.setup()`, MSW for the network (never mock the unit), coverage band 65–85% via `pnpm coverage`. Playwright calls `expectNoA11yViolations` + `expectButtonsShowPointer` after each meaningful state. If `pnpm analyze` reports a clone, extract a helper into `src/test/helpers.ts` (tests) or a shared module (app) — never raise the threshold.
- Comments explain why, never what. Commits: plain message, no `Co-Authored-By`, no AI attribution, files staged explicitly with `git add <paths>`. No `git push` in this phase (pushes are blocked); the human pushes later.
- The words banned by `scripts/check-hygiene.sh` never appear in code, tests, copy or docs.
- Copy: "Analyzing…" (US spelling, single `…` character), "Get feedback", "Retry analysis", "Revise & re-check", "New entry", "Load more", "Saved".

## Review Focus

- A latest analysis left `pending` (the browser disconnected mid-call, P2 Ruling R8) → History shows "Analysis interrupted" with "Retry analysis", Detail shows "The analysis did not finish." with Retry. (Task 6 test: seed one pending entry in the MSW store and assert both.)

- Entry text with an emoji or accented letters → every highlight covers exactly the mistake's snippet, because offsets are code points sliced with `Array.from`. (Task 4 `segmentText` emoji/accent tests; Task 1 mock-API offset contract test.)
- The model returns offsets that are null, out of range, empty or overlapping → nothing is dropped silently: the mistake appears under "Other notes", never as a broken highlight. (Task 4 `placeMistakes` tests + FeedbackView "Other notes" test.)
- The learner double-clicks "Get feedback" → exactly one entry is created, because the guard is a ref that flips before React re-renders the disabled button. (Task 5 double-submit test.)
- Saving fails → the draft stays in the textarea and in `localStorage` and the button works again; analysis fails after saving → the entry is kept and "Retry analysis" produces feedback. (Task 5 flow tests + e2e failure journey.)
- The learner opens an older analysis after revising the entry → it renders that analysis's own `input_text`, so its offsets still land on the right words. (Task 6 detail switcher test + e2e history journey.)

## File map

```
docker-compose.e2e.yml · Makefile (e2e-stack) · .github/workflows/ci.yml      (T7)
frontend/
  playwright.config.ts             e2e on :5174 with mocks forced on           (T1)
  playwright.stack.config.ts       full-stack smoke, no webServer               (T7)
  vite.config.ts                   /api + /health proxy → :8000                 (T1)
  index.html                       real meta description                        (T3)
  public/mockServiceWorker.js      generated by `msw init`                      (T1)
  e2e/{smoke,write,history}.spec.ts                                            (T3, T5, T6)
  e2e-stack/journal.spec.ts                                                    (T7)
  src/
    main.tsx · App.tsx · AppRoutes.tsx (+test)                                 (T1–T3)
    types/{language,analysis,entry,problem}.ts                                 (T1)
    utils/{constants,endpoints,client,text,formatter,errorMessage}.ts (+tests)  (T1, T5, T6)
    mocks/{factories,analyzer,seed,db,responses,handlers,browser}.ts (+tests)   (T1)
    hooks/queries/{journalKeys,useLanguagesQuery,useEntriesQuery,useEntryQuery,useAnalysesQuery}.ts  (T2)
    hooks/mutations/{useCreateEntryMutation,useUpdateEntryMutation,useRunAnalysisMutation}.ts        (T2)
    hooks/misc/{useEscapeKey,useLocalStorage,useFocusOnMount}.ts               (T4, T5)
    providers/AppProviders.tsx                                                 (T2)
    components/ui/{TextLink,Button,Badge,ErrorState,Select,Textarea,Field,LoadingState,EmptyState}/  (T3–T6)
    features/shell/AppShell.tsx                                                (T3)
    features/feedback/{segmentText,labels,markClasses}.ts
                     {Correction,AnnotatedText,MistakePanel,Legend,OtherNotes,FeedbackView,AnalysisFailure}.tsx  (T4)
    features/languages/{LanguageSelect.tsx,useLanguageName.ts}                 (T5, T6)
    features/editor/{EntryTextField,ReviseEditor,RevisableFeedback}.tsx, useReviseEntry.ts           (T5)
    features/write/{useDraft,useWriteSession}.ts, {EntryForm,WriteStatus,WriteEditor,WriteScreen}.tsx (T5)
    features/history/{HistoryList,HistoryResults,LoadMore,EntryRow,RetryAnalysisButton}.tsx           (T6)
    features/entry-detail/{EntryDetail,EntryHeader,AnalysisSwitcher,DetailAnalysis}.tsx              (T6)
    pages/{WritePage,HistoryPage,EntryDetailPage,NotFoundPage}.tsx             (T3, T5, T6)
    test/{setup.ts,server.ts,helpers.ts,renderWithProviders.tsx}               (T1, T2, T3, T5)
```

Tasks: 1 API client + in-memory API · 2 query/mutation hooks · 3 routing + shell · 4 FeedbackView · 5 Write · 6 History + Detail · 7 full-stack smoke · 8 phase checkpoint.

---

### Task 1: API client, shared types and the in-memory MSW API

**Files:**
- Modify: `frontend/package.json`, `frontend/pnpm-lock.yaml` (ky, msw, `msw.workerDirectory`)
- Create (generated): `frontend/public/mockServiceWorker.js`
- Create: `frontend/src/types/language.ts`, `frontend/src/types/analysis.ts`, `frontend/src/types/entry.ts`, `frontend/src/types/problem.ts`
- Create: `frontend/src/utils/constants.ts`, `frontend/src/utils/endpoints.ts`, `frontend/src/utils/client.ts`, `frontend/src/utils/text.ts`, `frontend/src/utils/formatter.ts`, `frontend/src/utils/errorMessage.ts`
- Create: `frontend/src/mocks/factories.ts`, `frontend/src/mocks/analyzer.ts`, `frontend/src/mocks/seed.ts`, `frontend/src/mocks/db.ts`, `frontend/src/mocks/responses.ts`, `frontend/src/mocks/handlers.ts`, `frontend/src/mocks/browser.ts`
- Create: `frontend/src/test/server.ts`, `frontend/src/test/helpers.ts`; Modify: `frontend/src/test/setup.ts`
- Modify: `frontend/src/main.tsx`, `frontend/src/env.d.ts`, `frontend/vite.config.ts`, `frontend/playwright.config.ts`, `frontend/CLAUDE.md`, `.env.example`, spec §7 and §14
- Test: `frontend/src/utils/text.test.ts`, `frontend/src/utils/formatter.test.ts`, `frontend/src/utils/errorMessage.test.ts`, `frontend/src/mocks/analyzer.test.ts`, `frontend/src/mocks/api.test.ts`

**Interfaces:**
- Consumes: nothing new (existing `cn`, `initMonitoring`).
- Produces:
  - Types: `LanguageOut {code, name}`; `MistakeKind`, `Category`, `AnalysisStatus`, `FailureCode` string unions; `MistakeOut {id, kind, category, original, correction, explanation, start: number|null, end: number|null}`; `AnalysisOut {id, entry_id, status, input_text, corrected_text: string|null, feedback_summary: string|null, model: string|null, prompt_version, error_code: FailureCode|null, latency_ms: number|null, created_at, completed_at: string|null, mistakes: MistakeOut[]}`; `EntryOut {id, language, text, word_count, created_at, updated_at}`; `EntryDetailOut extends EntryOut {latest_analysis: AnalysisOut|null}`; `EntrySummaryOut {id, language, preview, word_count, created_at, latest_status: AnalysisStatus|null, error_count}`; `EntryPageOut {items, next_cursor: string|null}`; `EntryCreate {language, text}`; `EntryUpdate {text}`; `ProblemDetails`.
  - `API_BASE: string`, `MAX_ENTRY_CHARS = 5000` (`utils/constants`); `ENDPOINTS.{languages, entries, entry(id), analyses(entryId)}` (relative, no leading slash); `client` (ky instance); `countWords(text): number`, `codePointLength(text): number` (`utils/text`); `pluralize(count, singular, plural?): string` (`utils/formatter`); `toErrorMessage(error: unknown): string` (`utils/errorMessage`).
  - Mocks: `handlers` (MSW), `worker` (browser), `resetMockDb()`, `listEntries(language, cursor, limit): EntryPageOut | null`, `SEEDED` ids, `buildMistake(overrides)`, `buildAnalysis(overrides)`, `analyzeText(entryId, text, createdAt?)`, `failedAnalysis(entryId, text, createdAt?)`.
  - Test helpers: `server` (`src/test/server.ts`); `apiUrl(path)`, `setMockMode(mode)`, `clearMockMode()` (`src/test/helpers.ts`).
  - Seed facts later tasks rely on: 14 entries (10 `es`, 4 `fr`), newest first: `SEEDED.revisedFrench` ("Je suis allé au marché avec ma sœur.", two analyses: latest 0 mistakes "Great job — no mistakes found!", older one error `à le → au` on "Je suis allé à le marché avec ma sœur."), `SEEDED.emoji` (2 errors), `SEEDED.failed` (latest failed, `provider_timeout`, text "Mañana voy a el cine con mis amigos."), `SEEDED.unanalysed` (no analyses), `SEEDED.otherNotes` (one unaligned suggestion).
  - `?mock=` modes: `slow` (2s delay), `error` (every route → 500 problem), `empty` (entry list empty), `analysis-fail` (the first analysis of each entry fails with `provider_timeout`, later ones succeed).

- [ ] **Step 1: Install the data-layer dependencies (ask the human first, per the api-integration skill)**

Run (inside `frontend/`):
```bash
pnpm add ky@2.1.0
pnpm add -D msw@2.15.0
pnpm exec msw init public --save
```
Expected: `package.json` gains `"ky": "2.1.0"`, `"msw": "2.15.0"` and `"msw": { "workerDirectory": ["public"] }`; `public/mockServiceWorker.js` exists.

- [ ] **Step 2: Write the failing tests for the pure helpers**

`frontend/src/utils/text.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { codePointLength, countWords } from './text'

describe('countWords', () => {
  it.each([
    ['', 0],
    ['   ', 0],
    ['Hola mundo', 2],
    ['  uno\n dos\ttres ', 3],
    ['¡Hola! [grocery store]', 3],
  ])('counts %j as %i words, splitting on any whitespace like the backend', (text, expected) => {
    // Arrange
    const input = text
    // Act
    const count = countWords(input)
    // Assert
    expect(count).toBe(expected)
  })
})

describe('codePointLength', () => {
  it('counts an emoji as one character, matching the API offsets', () => {
    // Arrange
    const text = 'Hoy 😀'
    // Act
    const length = codePointLength(text)
    // Assert
    expect(length).toBe(5)
    expect(text.length).toBe(6)
  })
})
```

`frontend/src/utils/formatter.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { pluralize } from './formatter'

describe('pluralize', () => {
  it.each([
    [0, '0 errors'],
    [1, '1 error'],
    [2, '2 errors'],
  ])('says %i as "%s"', (count, expected) => {
    // Arrange
    const noun = 'error'
    // Act
    const phrase = pluralize(count, noun)
    // Assert
    expect(phrase).toBe(expected)
  })

  it('accepts an irregular plural', () => {
    // Arrange
    const count = 3
    // Act
    const phrase = pluralize(count, 'entry', 'entries')
    // Assert
    expect(phrase).toBe('3 entries')
  })
})
```

Run: `pnpm -C frontend test src/utils/text.test.ts src/utils/formatter.test.ts`
Expected: FAIL — `Failed to resolve import "./text"` / `"./formatter"`.

- [ ] **Step 3: Implement the pure helpers, constants, endpoints, client and types**

`frontend/src/utils/text.ts`:
```ts
export function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed === '' ? 0 : trimmed.split(/\s+/u).length
}

// API offsets and the backend's length limit count Unicode code points, not UTF-16 units.
export function codePointLength(text: string): number {
  return Array.from(text).length
}
```

`frontend/src/utils/formatter.ts`:
```ts
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}
```

`frontend/src/utils/constants.ts`:
```ts
// Absolute base URL: ky 2 resolves `baseUrl` with `new Request()`, which rejects relative URLs outside a browser (tests).
export const API_BASE: string = import.meta.env.VITE_API_BASE ?? `${location.origin}/api/v1/`

export const MAX_ENTRY_CHARS = 5000
```

`frontend/src/utils/endpoints.ts`:
```ts
// One map of API paths — never inline URLs in hooks. No leading slash, so each path extends API_BASE.
export const ENDPOINTS = {
  languages: 'languages',
  entries: 'entries',
  entry: (id: string) => `entries/${id}`,
  analyses: (entryId: string) => `entries/${entryId}/analyses`,
} as const
```

`frontend/src/utils/client.ts`:
```ts
import ky from 'ky'
import { API_BASE } from './constants'

// Analysis is synchronous: a 30s model timeout plus one parse retry can approach a minute, so the client waits longer.
export const client = ky.create({ baseUrl: API_BASE, timeout: 90_000, retry: 0 })
```

`frontend/src/types/language.ts`:
```ts
export interface LanguageOut {
  code: string
  name: string
}
```

`frontend/src/types/analysis.ts`:
```ts
// Mirrors backend/app/api/schemas/analyses.py.
export type MistakeKind = 'error' | 'suggestion' | 'vocab_help'
export type Category =
  | 'verb_conjugation'
  | 'verb_tense'
  | 'gender_agreement'
  | 'number_agreement'
  | 'article'
  | 'preposition'
  | 'word_order'
  | 'spelling'
  | 'vocabulary'
  | 'punctuation'
  | 'other'
export type AnalysisStatus = 'pending' | 'succeeded' | 'failed'
export type FailureCode = 'provider_timeout' | 'invalid_output' | 'provider_error'

export interface MistakeOut {
  id: string
  kind: MistakeKind
  category: Category
  original: string
  correction: string
  explanation: string
  start: number | null
  end: number | null
}

export interface AnalysisOut {
  id: string
  entry_id: string
  status: AnalysisStatus
  input_text: string
  corrected_text: string | null
  feedback_summary: string | null
  model: string | null
  prompt_version: string
  error_code: FailureCode | null
  latency_ms: number | null
  created_at: string
  completed_at: string | null
  mistakes: MistakeOut[]
}
```

`frontend/src/types/entry.ts`:
```ts
import type { AnalysisOut, AnalysisStatus } from './analysis'

// Mirrors backend/app/api/schemas/entries.py.
export interface EntryOut {
  id: string
  language: string
  text: string
  word_count: number
  created_at: string
  updated_at: string
}

export interface EntryDetailOut extends EntryOut {
  latest_analysis: AnalysisOut | null
}

export interface EntrySummaryOut {
  id: string
  language: string
  preview: string
  word_count: number
  created_at: string
  latest_status: AnalysisStatus | null
  error_count: number
}

export interface EntryPageOut {
  items: EntrySummaryOut[]
  next_cursor: string | null
}

export interface EntryCreate {
  language: string
  text: string
}

export interface EntryUpdate {
  text: string
}
```

`frontend/src/types/problem.ts`:
```ts
// RFC 7807 body every backend error uses (backend/app/core/errors.py).
export interface ProblemDetails {
  type: string
  title: string
  status: number
  detail: string
  instance?: string
  request_id?: string | null
  errors?: { loc: (string | number)[]; msg: string; type: string }[]
}
```

Add to `frontend/src/env.d.ts` (inside `ImportMetaEnv`, keep the existing two lines):
```ts
  readonly VITE_API_BASE?: string
  readonly VITE_API_MOCKS?: string
```

Run: `pnpm -C frontend test src/utils/text.test.ts src/utils/formatter.test.ts`
Expected: PASS.

- [ ] **Step 4: Write the failing mock-analyzer and mock-API tests**

`frontend/src/mocks/analyzer.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { analyzeText, failedAnalysis } from './analyzer'

const slice = (text: string, start: number | null, end: number | null) =>
  Array.from(text)
    .slice(start ?? 0, end ?? 0)
    .join('')

describe('mock analyzer', () => {
  it('places every mistake at code-point offsets that slice back to its snippet', () => {
    // Arrange
    const text = 'Hoy 😀 la problema fue difícil, pero yo es optimista en el [park].'
    // Act
    const analysis = analyzeText('entry-1', text)
    // Assert
    expect(analysis.mistakes.map((m) => slice(text, m.start, m.end))).toEqual(['la problema', 'yo es', '[park]'])
    expect(analysis.mistakes.map((m) => m.kind)).toEqual(['error', 'error', 'vocab_help'])
  })

  it('writes the corrected text with every fix applied', () => {
    // Arrange
    const text = 'Ayer yo es feliz en el [park].'
    // Act
    const analysis = analyzeText('entry-1', text)
    // Assert
    expect(analysis.corrected_text).toBe('Ayer yo soy feliz en el parque.')
    expect(analysis.feedback_summary).toBe('Good effort! 2 things to look at.')
  })

  it('praises text with nothing to fix', () => {
    // Arrange
    const text = 'Ayer fui feliz.'
    // Act
    const analysis = analyzeText('entry-1', text)
    // Assert
    expect(analysis.mistakes).toEqual([])
    expect(analysis.feedback_summary).toBe('Great job — no mistakes found!')
  })

  it('does not match a phrase hidden inside a longer word', () => {
    // Arrange
    const text = 'Entré en la sala el lunes.'
    // Act
    const analysis = analyzeText('entry-1', text)
    // Assert
    expect(analysis.mistakes).toEqual([])
  })

  it('records a timeout as a failed analysis with no mistakes', () => {
    // Arrange
    const text = 'Hola'
    // Act
    const analysis = failedAnalysis('entry-1', text)
    // Assert
    expect(analysis).toMatchObject({ status: 'failed', error_code: 'provider_timeout', mistakes: [], corrected_text: null })
  })
})
```

`frontend/src/mocks/api.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { setMockMode } from '@/test/helpers'
import type { AnalysisOut } from '@/types/analysis'
import type { EntryDetailOut, EntryOut, EntryPageOut } from '@/types/entry'
import { client } from '@/utils/client'
import { ENDPOINTS } from '@/utils/endpoints'
import { SEEDED } from './seed'

const createEntry = (text: string, language = 'es') =>
  client.post(ENDPOINTS.entries, { json: { language, text } }).json<EntryOut>()
const analyse = (id: string) => client.post(ENDPOINTS.analyses(id)).json<AnalysisOut>()
const page = (searchParams: Record<string, string | number>) =>
  client.get(ENDPOINTS.entries, { searchParams }).json<EntryPageOut>()

describe('in-memory API', () => {
  it('normalises a new entry like the backend does', async () => {
    // Arrange
    const text = '  Hola\r\nmundo  '
    // Act
    const entry = await createEntry(text)
    // Assert
    expect(entry).toMatchObject({ text: 'Hola\nmundo', word_count: 2, language: 'es' })
  })

  it('stores an analysis as the entry’s latest one', async () => {
    // Arrange
    const entry = await createEntry('Ayer yo es feliz.')
    // Act
    const analysis = await analyse(entry.id)
    const detail = await client.get(ENDPOINTS.entry(entry.id)).json<EntryDetailOut>()
    // Assert
    expect(detail.latest_analysis?.id).toBe(analysis.id)
  })

  it('pages newest first with a cursor until the last page', async () => {
    // Arrange
    const first = await page({ limit: 10 })
    // Act
    const second = await page({ limit: 10, cursor: first.next_cursor ?? '' })
    // Assert
    expect(first.items).toHaveLength(10)
    expect(first.items[0]?.id).toBe(SEEDED.revisedFrench)
    expect(second.items).toHaveLength(4)
    expect(second.next_cursor).toBeNull()
  })

  it('filters the list by language', async () => {
    // Arrange
    const language = 'fr'
    // Act
    const french = await page({ language })
    // Assert
    expect(french.items.map((item) => item.language)).toEqual(['fr', 'fr', 'fr', 'fr'])
  })

  it('reports the latest status and error count of each entry', async () => {
    // Arrange
    const { items } = await page({ limit: 50 })
    // Act
    const byId = new Map(items.map((item) => [item.id, item]))
    // Assert
    expect(byId.get(SEEDED.failed)).toMatchObject({ latest_status: 'failed', error_count: 0 })
    expect(byId.get(SEEDED.unanalysed)).toMatchObject({ latest_status: null, error_count: 0 })
    expect(byId.get(SEEDED.emoji)).toMatchObject({ latest_status: 'succeeded', error_count: 2 })
  })

  it('keeps every seeded offset aligned with its snippet', async () => {
    // Arrange
    const { items } = await page({ limit: 50 })
    // Act
    const histories = await Promise.all(
      items.map((item) => client.get(ENDPOINTS.analyses(item.id)).json<AnalysisOut[]>()),
    )
    // Assert
    const misaligned = histories
      .flat()
      .flatMap((a) =>
        a.mistakes.filter(
          (m) => m.start !== null && Array.from(a.input_text).slice(m.start, m.end ?? undefined).join('') !== m.original,
        ),
      )
    expect(misaligned).toEqual([])
  })

  it('answers an unknown entry with a 404 problem', async () => {
    // Arrange
    const request = client.get(ENDPOINTS.entry('missing')).json()
    // Act + Assert
    await expect(request).rejects.toMatchObject({ response: { status: 404 }, data: { title: 'Not Found' } })
  })

  it('rejects blank text with a 422 problem', async () => {
    // Arrange
    const request = createEntry('   ')
    // Act + Assert
    await expect(request).rejects.toMatchObject({ response: { status: 422 } })
  })

  it('fails the first analysis in analysis-fail mode and succeeds on retry', async () => {
    // Arrange
    setMockMode('analysis-fail')
    const entry = await createEntry('Ayer yo es feliz.')
    // Act
    const first = await analyse(entry.id)
    const retry = await analyse(entry.id)
    // Assert
    expect(first).toMatchObject({ status: 'failed', error_code: 'provider_timeout' })
    expect(retry.status).toBe('succeeded')
  })

  it('returns no entries in empty mode', async () => {
    // Arrange
    setMockMode('empty')
    // Act
    const result = await page({})
    // Assert
    expect(result).toEqual({ items: [], next_cursor: null })
  })

  it('answers every route with a 500 problem in error mode', async () => {
    // Arrange
    setMockMode('error')
    // Act
    const request = client.get(ENDPOINTS.languages).json()
    // Assert
    await expect(request).rejects.toMatchObject({ response: { status: 500 } })
  })
})
```

`frontend/src/utils/errorMessage.test.ts`:
```ts
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { apiUrl } from '@/test/helpers'
import { server } from '@/test/server'
import { client } from './client'
import { toErrorMessage } from './errorMessage'

const problemJson = (status: number, body: object) =>
  HttpResponse.json(
    { type: 'about:blank', title: 'Error', status, detail: 'Failed', ...body },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  )

async function errorFrom(resolver: () => Response): Promise<unknown> {
  server.use(http.get(apiUrl('probe'), resolver))
  return client
    .get('probe')
    .json()
    .then(
      () => null,
      (error: unknown) => error,
    )
}

describe('toErrorMessage', () => {
  it('explains a missing entry', async () => {
    // Arrange
    const error = await errorFrom(() => problemJson(404, {}))
    // Act
    const message = toErrorMessage(error)
    // Assert
    expect(message).toBe("We couldn't find that entry. It may have been removed.")
  })

  it('passes on the first validation message', async () => {
    // Arrange
    const errors = [{ loc: ['body', 'text'], msg: 'String should have at most 5000 characters', type: 'string_too_long' }]
    const error = await errorFrom(() => problemJson(422, { errors }))
    // Act
    const message = toErrorMessage(error)
    // Assert
    expect(message).toBe('Please check your entry: String should have at most 5000 characters.')
  })

  it('adds the request id to server errors so a report can be traced', async () => {
    // Arrange
    const error = await errorFrom(() => problemJson(500, { request_id: 'req-123' }))
    // Act
    const message = toErrorMessage(error)
    // Assert
    expect(message).toBe('Something went wrong on our side. Please try again. (Reference: req-123)')
  })

  it('uses the problem detail for other client errors', async () => {
    // Arrange
    const error = await errorFrom(() => problemJson(400, { detail: 'Invalid cursor' }))
    // Act
    const message = toErrorMessage(error)
    // Assert
    expect(message).toBe('Invalid cursor')
  })

  it('explains a dropped connection', async () => {
    // Arrange
    const error = await errorFrom(() => HttpResponse.error())
    // Act
    const message = toErrorMessage(error)
    // Assert
    expect(message).toBe("We couldn't reach the server. Check your connection and try again.")
  })

  it('falls back to a generic message for anything else', () => {
    // Arrange
    const error = new Error('boom')
    // Act
    const message = toErrorMessage(error)
    // Assert
    expect(message).toBe('Something went wrong. Please try again.')
  })
})
```

Run: `pnpm -C frontend test src/mocks src/utils/errorMessage.test.ts`
Expected: FAIL — unresolved imports (`./analyzer`, `./seed`, `@/test/helpers`, `./errorMessage`).

- [ ] **Step 5: Implement `toErrorMessage`**

`frontend/src/utils/errorMessage.ts`:
```ts
import { isHTTPError, isNetworkError, isTimeoutError } from 'ky'
import type { ProblemDetails } from '@/types/problem'

const FALLBACK = 'Something went wrong. Please try again.'

export function toErrorMessage(error: unknown): string {
  if (isTimeoutError(error)) return 'The server took too long to respond. Please try again.'
  // A raw TypeError is what fetch throws when the network drops before ky can wrap it.
  if (isNetworkError(error) || error instanceof TypeError) {
    return "We couldn't reach the server. Check your connection and try again."
  }
  if (isHTTPError(error)) return fromProblem(error.response.status, asProblem(error.data))
  return FALLBACK
}

function fromProblem(status: number, problem: ProblemDetails | null): string {
  if (status === 404) return "We couldn't find that entry. It may have been removed."
  if (status === 422) return validationMessage(problem)
  if (status >= 500) return withReference('Something went wrong on our side. Please try again.', problem)
  return problem?.detail ?? FALLBACK
}

function validationMessage(problem: ProblemDetails | null): string {
  const first = problem?.errors?.[0]?.msg
  return first ? `Please check your entry: ${first}.` : 'Please check your entry and try again.'
}

// The request id lets a bug report be matched to the backend log line without exposing anything else.
function withReference(message: string, problem: ProblemDetails | null): string {
  return problem?.request_id ? `${message} (Reference: ${problem.request_id})` : message
}

function asProblem(data: unknown): ProblemDetails | null {
  return typeof data === 'object' && data !== null && 'status' in data ? (data as ProblemDetails) : null
}
```

- [ ] **Step 6: Implement the mock factories and analyzer**

`frontend/src/mocks/factories.ts`:
```ts
import type { AnalysisOut, MistakeOut } from '@/types/analysis'

const CREATED_AT = '2026-10-09T18:00:00.000Z'
let sequence = 0

export function nextId(prefix: string): string {
  sequence += 1
  return `${prefix}-${sequence}`
}

export function buildMistake(overrides: Partial<MistakeOut> = {}): MistakeOut {
  return {
    id: nextId('mistake'),
    kind: 'error',
    category: 'verb_conjugation',
    original: 'yo es',
    correction: 'yo soy',
    explanation: 'With «yo», «ser» is conjugated «soy».',
    start: 5,
    end: 10,
    ...overrides,
  }
}

export function buildAnalysis(overrides: Partial<AnalysisOut> = {}): AnalysisOut {
  return {
    id: nextId('analysis'),
    entry_id: 'entry-test',
    status: 'succeeded',
    input_text: 'Ayer yo es feliz.',
    corrected_text: 'Ayer yo soy feliz.',
    feedback_summary: 'Good effort! 1 thing to look at.',
    model: 'mock',
    prompt_version: 'v1',
    error_code: null,
    latency_ms: 850,
    created_at: CREATED_AT,
    completed_at: CREATED_AT,
    mistakes: [buildMistake()],
    ...overrides,
  }
}
```

`frontend/src/mocks/analyzer.ts`:
```ts
import type { AnalysisOut, Category, MistakeKind, MistakeOut } from '@/types/analysis'
import { pluralize } from '@/utils/formatter'
import { codePointLength } from '@/utils/text'
import { buildAnalysis, buildMistake } from './factories'

interface Rule {
  pattern: RegExp
  correct: (found: string) => string
  kind: MistakeKind
  category: Category
  explanation: string
}

interface Hit {
  index: number
  original: string
  correction: string
  rule: Rule
}

// `\b` is ASCII-only in JS, so word edges are letter lookarounds that also respect «à» or «é».
const phrase = (words: string) => new RegExp(`(?<!\\p{L})${words}(?!\\p{L})`, 'giu')
const always = (value: string) => () => value

const GLOSSARY: Record<string, string> = { park: 'parque', pie: 'tarte', paella: 'paella', 'grocery store': 'supermercado' }
const bracketed = (found: string) => found.slice(1, -1)

// The same demo rules as the backend's fake provider, plus a suggestion and a small glossary.
const RULES: Rule[] = [
  { pattern: phrase('yo es'), correct: always('yo soy'), kind: 'error', category: 'verb_conjugation', explanation: 'With «yo», «ser» is conjugated «soy».' },
  { pattern: phrase('la problema'), correct: always('el problema'), kind: 'error', category: 'gender_agreement', explanation: '«Problema» is masculine even though it ends in -a.' },
  { pattern: phrase('a el'), correct: always('al'), kind: 'error', category: 'article', explanation: '«A» + «el» always contracts to «al».' },
  { pattern: phrase('à le'), correct: always('au'), kind: 'error', category: 'article', explanation: '«À» + «le» always contracts to «au».' },
  { pattern: phrase('muy bueno'), correct: always('estupendo'), kind: 'suggestion', category: 'vocabulary', explanation: '«Estupendo» sounds more natural than «muy bueno» here.' },
  {
    pattern: /\[([^[\]]+)\]/gu,
    correct: (found) => GLOSSARY[bracketed(found).toLowerCase()] ?? bracketed(found),
    kind: 'vocab_help',
    category: 'vocabulary',
    explanation: 'Here is the word you were looking for.',
  },
]

function findHits(text: string): Hit[] {
  const hits = RULES.flatMap((rule) =>
    Array.from(text.matchAll(rule.pattern), (match) => ({
      index: match.index,
      original: match[0],
      correction: rule.correct(match[0]),
      rule,
    })),
  )
  return withoutOverlaps(hits.sort((a, b) => a.index - b.index))
}

function withoutOverlaps(sorted: Hit[]): Hit[] {
  const kept: Hit[] = []
  let end = 0
  for (const hit of sorted) {
    if (hit.index < end) continue
    kept.push(hit)
    end = hit.index + hit.original.length
  }
  return kept
}

function toMistake(text: string, hit: Hit): MistakeOut {
  const start = codePointLength(text.slice(0, hit.index))
  const { kind, category, explanation } = hit.rule
  return buildMistake({ kind, category, explanation, original: hit.original, correction: hit.correction, start, end: start + codePointLength(hit.original) })
}

function applyFixes(text: string, hits: Hit[]): string {
  let corrected = ''
  let from = 0
  for (const hit of hits) {
    corrected += text.slice(from, hit.index) + hit.correction
    from = hit.index + hit.original.length
  }
  return corrected + text.slice(from)
}

function summarise(count: number): string {
  return count === 0 ? 'Great job — no mistakes found!' : `Good effort! ${pluralize(count, 'thing')} to look at.`
}

export function analyzeText(entryId: string, text: string, createdAt = new Date().toISOString()): AnalysisOut {
  const hits = findHits(text)
  return buildAnalysis({
    entry_id: entryId,
    input_text: text,
    corrected_text: applyFixes(text, hits),
    feedback_summary: summarise(hits.length),
    created_at: createdAt,
    completed_at: createdAt,
    mistakes: hits.map((hit) => toMistake(text, hit)),
  })
}

export function failedAnalysis(entryId: string, text: string, createdAt = new Date().toISOString()): AnalysisOut {
  return buildAnalysis({
    entry_id: entryId,
    status: 'failed',
    input_text: text,
    corrected_text: null,
    feedback_summary: null,
    model: null,
    error_code: 'provider_timeout',
    created_at: createdAt,
    completed_at: createdAt,
    mistakes: [],
  })
}
```

- [ ] **Step 7: Implement the seed, store, responses, handlers and browser worker**

`frontend/src/mocks/seed.ts`:
```ts
import type { AnalysisOut } from '@/types/analysis'
import type { EntryOut } from '@/types/entry'
import { countWords } from '@/utils/text'
import { analyzeText, failedAnalysis } from './analyzer'
import { buildMistake } from './factories'

export interface Store {
  entries: EntryOut[]
  analyses: AnalysisOut[]
}

// Fixed ids so tests, e2e and ui-qa can open specific demo entries.
export const SEEDED = {
  revisedFrench: 'entry-fr-revised',
  emoji: 'entry-es-emoji',
  failed: 'entry-es-failed',
  unanalysed: 'entry-es-unanalysed',
  otherNotes: 'entry-es-notes',
} as const

interface Sample {
  id: string
  language: string
  text: string
}

const NEWEST = Date.parse('2026-10-09T18:00:00Z')
const HOUR = 3_600_000
const hoursBefore = (hours: number) => new Date(NEWEST - hours * HOUR).toISOString()

// Newest first: the first ten fill page one of History, the last four need "Load more".
const SAMPLES: Sample[] = [
  { id: SEEDED.revisedFrench, language: 'fr', text: 'Je suis allé au marché avec ma sœur.' },
  { id: SEEDED.emoji, language: 'es', text: 'Hoy 😀 la problema fue difícil, pero yo es optimista.' },
  { id: SEEDED.failed, language: 'es', text: 'Mañana voy a el cine con mis amigos.' },
  { id: SEEDED.unanalysed, language: 'es', text: 'Escribo esto antes de dormir.' },
  { id: SEEDED.otherNotes, language: 'es', text: 'El fin de semana fue muy bueno y yo es feliz.' },
  { id: 'entry-fr-park', language: 'fr', text: 'Hier, je suis allé à le parc.' },
  { id: 'entry-fr-books', language: 'fr', text: 'J’aime lire le soir.' },
  { id: 'entry-fr-pie', language: 'fr', text: 'Nous avons mangé une [pie] délicieuse.' },
  { id: 'entry-es-park', language: 'es', text: 'Ayer yo es feliz en el [park].' },
  { id: 'entry-es-market', language: 'es', text: 'Fui a el mercado por la mañana.' },
  { id: 'entry-es-house', language: 'es', text: 'Mi casa es pequeña pero bonita.' },
  { id: 'entry-es-car', language: 'es', text: 'Creo que la problema es el motor.' },
  { id: 'entry-es-paella', language: 'es', text: 'Quiero aprender a cocinar [paella] este año.' },
  { id: 'entry-es-train', language: 'es', text: 'El tren llegó tarde otra vez.' },
]

function toEntry(sample: Sample, createdAt: string): EntryOut {
  return { ...sample, word_count: countWords(sample.text), created_at: createdAt, updated_at: createdAt }
}

// The learner fixed «à le» and re-checked: the older analysis keeps the text it was run on.
function revisedHistory(entry: EntryOut): AnalysisOut[] {
  const revisedAt = new Date(Date.parse(entry.created_at) + HOUR / 2).toISOString()
  return [
    analyzeText(entry.id, 'Je suis allé à le marché avec ma sœur.', entry.created_at),
    analyzeText(entry.id, entry.text, revisedAt),
  ]
}

// The aligner leaves offsets null when a snippet overlaps other highlights; the UI lists it under "Other notes".
function withUnplacedNote(analysis: AnalysisOut): AnalysisOut {
  const note = buildMistake({
    kind: 'suggestion',
    category: 'other',
    original: 'muy bueno y yo es',
    correction: 'estupendo y yo soy',
    explanation: 'Both fixes together read: «fue estupendo y yo soy feliz».',
    start: null,
    end: null,
  })
  return { ...analysis, mistakes: [...analysis.mistakes, note] }
}

function historyFor(entry: EntryOut): AnalysisOut[] {
  switch (entry.id) {
    case SEEDED.unanalysed:
      return []
    case SEEDED.failed:
      return [failedAnalysis(entry.id, entry.text, entry.created_at)]
    case SEEDED.revisedFrench:
      return revisedHistory(entry)
    case SEEDED.otherNotes:
      return [withUnplacedNote(analyzeText(entry.id, entry.text, entry.created_at))]
    default:
      return [analyzeText(entry.id, entry.text, entry.created_at)]
  }
}

export function seedStore(): Store {
  const entries = SAMPLES.map((sample, index) => toEntry(sample, hoursBefore(index * 5)))
  return { entries, analyses: entries.flatMap(historyFor) }
}
```

`frontend/src/mocks/db.ts`:
```ts
import type { AnalysisOut } from '@/types/analysis'
import type { EntryDetailOut, EntryOut, EntryPageOut, EntrySummaryOut } from '@/types/entry'
import { countWords } from '@/utils/text'
import { nextId } from './factories'
import { seedStore, type Store } from './seed'

const PREVIEW_LENGTH = 140
let store: Store = seedStore()

export function resetMockDb(): void {
  store = seedStore()
}

const newestFirst = <T extends { created_at: string }>(a: T, b: T) => b.created_at.localeCompare(a.created_at)

export function findEntry(id: string): EntryOut | undefined {
  return store.entries.find((entry) => entry.id === id)
}

export function analysesOf(entryId: string): AnalysisOut[] {
  return store.analyses.filter((analysis) => analysis.entry_id === entryId).sort(newestFirst)
}

export function entryDetail(entry: EntryOut): EntryDetailOut {
  return { ...entry, latest_analysis: analysesOf(entry.id)[0] ?? null }
}

export function createEntry(language: string, text: string): EntryOut {
  const now = new Date().toISOString()
  const entry = { id: nextId('entry'), language, text, word_count: countWords(text), created_at: now, updated_at: now }
  store.entries.push(entry)
  return entry
}

export function updateEntry(entry: EntryOut, text: string): EntryOut {
  Object.assign(entry, { text, word_count: countWords(text), updated_at: new Date().toISOString() })
  return entry
}

export function addAnalysis(analysis: AnalysisOut): AnalysisOut {
  store.analyses.push(analysis)
  return analysis
}

// Returns null for an unknown cursor, which the handler turns into the backend's 400.
export function listEntries(language: string | null, cursor: string | null, limit: number): EntryPageOut | null {
  const matching = store.entries.filter((entry) => !language || entry.language === language).sort(newestFirst)
  const after = cursor === null ? -1 : matching.findIndex((entry) => entry.id === cursor)
  if (cursor !== null && after === -1) return null
  const items = matching.slice(after + 1, after + 1 + limit)
  const last = items.at(-1)
  const hasMore = after + 1 + limit < matching.length
  return { items: items.map(summarise), next_cursor: hasMore && last ? last.id : null }
}

function summarise(entry: EntryOut): EntrySummaryOut {
  const latest = analysesOf(entry.id)[0]
  return {
    id: entry.id,
    language: entry.language,
    preview: entry.text.length <= PREVIEW_LENGTH ? entry.text : `${entry.text.slice(0, PREVIEW_LENGTH).trimEnd()}…`,
    word_count: entry.word_count,
    created_at: entry.created_at,
    latest_status: latest?.status ?? null,
    error_count: latest?.mistakes.filter((mistake) => mistake.kind === 'error').length ?? 0,
  }
}
```

`frontend/src/mocks/responses.ts`:
```ts
import { HttpResponse } from 'msw'
import type { LanguageOut } from '@/types/language'
import { MAX_ENTRY_CHARS } from '@/utils/constants'
import { codePointLength } from '@/utils/text'

export const LANGUAGES: LanguageOut[] = [
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
]

export function problem(status: number, title: string, detail: string, extra: object = {}): Response {
  return HttpResponse.json(
    { type: 'about:blank', title, status, detail, request_id: 'mock-request', ...extra },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  )
}

export const notFound = () => problem(404, 'Not Found', 'Entry not found')

export const invalid = () =>
  problem(422, 'Unprocessable Content', 'Request validation failed', {
    errors: [{ loc: ['body', 'text'], msg: `Text must be between 1 and ${MAX_ENTRY_CHARS} characters`, type: 'value_error' }],
  })

const field = (body: unknown, name: string): unknown =>
  typeof body === 'object' && body !== null && name in body ? (body as Record<string, unknown>)[name] : undefined

// Mirrors the backend: trimmed, NFC, \n line endings, 1–5000 code points.
export function cleanText(body: unknown): string | null {
  const raw = field(body, 'text')
  if (typeof raw !== 'string') return null
  const text = raw.trim().normalize('NFC').replace(/\r\n?/gu, '\n')
  const length = codePointLength(text)
  return length >= 1 && length <= MAX_ENTRY_CHARS ? text : null
}

export function cleanLanguage(body: unknown): string | null {
  const raw = field(body, 'language')
  return LANGUAGES.some((language) => language.code === raw) ? String(raw) : null
}
```

`frontend/src/mocks/handlers.ts`:
```ts
import { delay, http, HttpResponse } from 'msw'
import { API_BASE } from '@/utils/constants'
import { ENDPOINTS } from '@/utils/endpoints'
import { analyzeText, failedAnalysis } from './analyzer'
import { addAnalysis, analysesOf, createEntry, entryDetail, findEntry, listEntries, updateEntry } from './db'
import { cleanLanguage, cleanText, invalid, LANGUAGES, notFound, problem } from './responses'

// `?mock=slow|error|empty|analysis-fail` forces UI states in dev, e2e and ui-qa runs.
const mockMode = () => (typeof location === 'undefined' ? '' : (new URLSearchParams(location.search).get('mock') ?? ''))
const url = (path: string) => `${API_BASE}${path}`
const ENTRY = url(ENDPOINTS.entry(':entryId'))
const ANALYSES = url(ENDPOINTS.analyses(':entryId'))

async function forcedResponse(): Promise<Response | undefined> {
  const mode = mockMode()
  await delay(mode === 'slow' ? 2000 : undefined)
  return mode === 'error' ? problem(500, 'Internal Server Error', 'Something went wrong') : undefined
}

function list(requestUrl: string): Response {
  if (mockMode() === 'empty') return HttpResponse.json({ items: [], next_cursor: null })
  const params = new URL(requestUrl).searchParams
  const page = listEntries(params.get('language'), params.get('cursor'), Number(params.get('limit') ?? 20))
  return page ? HttpResponse.json(page) : problem(400, 'Bad Request', 'Invalid cursor')
}

function create(body: unknown): Response {
  const language = cleanLanguage(body)
  const text = cleanText(body)
  if (!language || !text) return invalid()
  return HttpResponse.json(createEntry(language, text), { status: 201 })
}

function detail(entryId: string): Response {
  const entry = findEntry(entryId)
  return entry ? HttpResponse.json(entryDetail(entry)) : notFound()
}

function update(entryId: string, body: unknown): Response {
  const entry = findEntry(entryId)
  const text = cleanText(body)
  if (!entry) return notFound()
  return text ? HttpResponse.json(updateEntry(entry, text)) : invalid()
}

// Like the backend, a failed analysis is a stored 201 resource, not an HTTP error.
function analyze(entryId: string): Response {
  const entry = findEntry(entryId)
  if (!entry) return notFound()
  const failFirst = mockMode() === 'analysis-fail' && analysesOf(entryId).length === 0
  const analysis = failFirst ? failedAnalysis(entry.id, entry.text) : analyzeText(entry.id, entry.text)
  return HttpResponse.json(addAnalysis(analysis), { status: 201 })
}

function history(entryId: string): Response {
  return findEntry(entryId) ? HttpResponse.json(analysesOf(entryId)) : notFound()
}

export const handlers = [
  http.get(url(ENDPOINTS.languages), async () => (await forcedResponse()) ?? HttpResponse.json(LANGUAGES)),
  http.get(url(ENDPOINTS.entries), async ({ request }) => (await forcedResponse()) ?? list(request.url)),
  http.post(url(ENDPOINTS.entries), async ({ request }) => (await forcedResponse()) ?? create(await request.json())),
  http.get(ENTRY, async ({ params }) => (await forcedResponse()) ?? detail(String(params.entryId))),
  http.patch(ENTRY, async ({ params, request }) => (await forcedResponse()) ?? update(String(params.entryId), await request.json())),
  http.post(ANALYSES, async ({ params }) => (await forcedResponse()) ?? analyze(String(params.entryId))),
  http.get(ANALYSES, async ({ params }) => (await forcedResponse()) ?? history(String(params.entryId))),
]
```

`frontend/src/mocks/browser.ts`:
```ts
import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

export const worker = setupWorker(...handlers)
```

- [ ] **Step 8: Wire the test server, helpers and setup**

`frontend/src/test/server.ts`:
```ts
import { setupServer } from 'msw/node'
import { handlers } from '@/mocks/handlers'

/** Same handlers as dev; override per test with `server.use(...)`. */
export const server = setupServer(...handlers)
```

`frontend/src/test/helpers.ts`:
```ts
import { API_BASE } from '@/utils/constants'

export const apiUrl = (path: string) => `${API_BASE}${path}`

// The in-memory API reads `?mock=` from the window location; MemoryRouter never touches it.
export function setMockMode(mode: string): void {
  window.history.replaceState(null, '', `/?mock=${mode}`)
}

export function clearMockMode(): void {
  window.history.replaceState(null, '', '/')
}
```

Replace `frontend/src/test/setup.ts` with:
```ts
import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import { resetMockDb } from '@/mocks/db'
import { clearMockMode } from './helpers'
import { server } from './server'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  cleanup()
  resetMockDb()
  localStorage.clear()
  clearMockMode()
})
afterAll(() => server.close())
```

Run: `pnpm -C frontend test`
Expected: PASS (all new tests plus the existing `App`, `cn` and monitoring tests).

- [ ] **Step 9: Start MSW in dev unless switched off; proxy to the real backend otherwise**

Replace `frontend/src/main.tsx` with:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App.tsx'
import { initMonitoring } from './utils/monitoring'

// Mocks run in dev (unless VITE_API_MOCKS=off, which talks to `make dev-backend` through the Vite proxy) and in the
// `mock` build the Lighthouse gate audits — never in a real production build.
const mocksEnabled = import.meta.env.MODE === 'mock' || (import.meta.env.DEV && import.meta.env.VITE_API_MOCKS !== 'off')

async function enableMocks(): Promise<void> {
  if (!mocksEnabled) return
  const { worker } = await import('./mocks/browser')
  await worker.start({ onUnhandledRequest: 'bypass', quiet: true })
}

const root = document.getElementById('root')
if (!root) throw new Error('#root element missing from index.html')

void initMonitoring()

void enableMocks().then(() => {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
```

In `frontend/vite.config.ts`, add inside `defineConfig({ ... })` after `resolve`:
```ts
  // Same paths nginx proxies in Compose, so `VITE_API_MOCKS=off pnpm dev` works against `make dev-backend`.
  server: { proxy: { '/api': 'http://localhost:8000', '/health': 'http://localhost:8000' } },
```

Replace `frontend/playwright.config.ts` with:
```ts
import { defineConfig, devices } from '@playwright/test'

// Own port and forced mocks: e2e must never reuse a dev server that is proxying to a real backend.
const PORT = 5174

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 375, height: 812 } } },
  ],
  webServer: {
    command: `pnpm dev --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    env: { VITE_API_MOCKS: 'on' },
  },
})
```

Append to `.env.example` (after `VITE_RELEASE=dev`):
```
# Frontend dev data: the in-memory MSW API is on by default; set off to use `make dev-backend` via the Vite proxy.
VITE_API_MOCKS=on
# VITE_API_BASE=   (absolute API base; defaults to <page origin>/api/v1/)
```

In `frontend/CLAUDE.md`, under `## Commands`, add a line:
```
- Dev data: MSW in-memory API (`src/mocks`) with `?mock=slow|error|empty|analysis-fail`; `VITE_API_MOCKS=off pnpm dev` talks to `make dev-backend` through the Vite proxy. E2E runs its own server on :5174 with mocks forced on.
```

In the spec: §7 replace `` (`?mock=error|empty|slow`) `` with `` (`?mock=error|empty|slow|analysis-fail`) ``; §14 replace `VITE_API_BASE_URL` with `VITE_API_BASE, VITE_API_MOCKS`.

- [ ] **Step 10: Gates**

Run: `make verify`
Expected: ends with `ALL GATES GREEN` (the smoke e2e still passes; Lighthouse builds `--mode mock`, which now starts the worker). If `pnpm analyze` flags `public/mockServiceWorker.js`, it is already ignored by `.fallowrc.json` (`public/**`); if it flags an unused export, delete the export rather than ignoring it.

- [ ] **Step 11: Commit**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml frontend/public/mockServiceWorker.js \
  frontend/src/types frontend/src/utils frontend/src/mocks frontend/src/test \
  frontend/src/main.tsx frontend/src/env.d.ts frontend/vite.config.ts frontend/playwright.config.ts \
  frontend/CLAUDE.md .env.example docs/superpowers/specs/2026-10-10-ai-language-journal-design.md
git commit -m "feat(frontend): API client, shared types and an in-memory MSW API with demo data" \
  -m "ky@2.1.0: small fetch wrapper with timeouts and HTTPError carrying the parsed problem+json body." \
  -m "msw@2.15.0 (dev): one in-memory API for dev, Vitest, Playwright and the Lighthouse mock build."
```

---

### Task 2: Query and mutation hooks with the app's QueryClient

**Files:**
- Modify: `frontend/package.json`, `frontend/pnpm-lock.yaml` (+ `@tanstack/react-query`)
- Modify: `frontend/src/utils/constants.ts` (+ `PAGE_SIZE`)
- Create: `frontend/src/hooks/queries/journalKeys.ts`, `useLanguagesQuery.ts`, `useEntriesQuery.ts`, `useEntryQuery.ts`, `useAnalysesQuery.ts`
- Create: `frontend/src/hooks/mutations/useCreateEntryMutation.ts`, `useUpdateEntryMutation.ts`, `useRunAnalysisMutation.ts`
- Create: `frontend/src/providers/AppProviders.tsx`, `frontend/src/test/renderWithProviders.tsx`
- Modify: `frontend/src/main.tsx`, `frontend/src/App.test.tsx`
- Test: `frontend/src/hooks/queries/queries.test.tsx`, `frontend/src/hooks/mutations/mutations.test.tsx`

**Interfaces:**
- Consumes: `client`, `ENDPOINTS`, types, `SEEDED`, `setMockMode`, `toErrorMessage` (Task 1).
- Produces:
  - `PAGE_SIZE = 10` (`utils/constants`).
  - `journalKeys = { languages, entryLists, entryList(language: string | null), entry(id), analyses(id) }` — `entry(id)` is a prefix of `analyses(id)`.
  - `useLanguagesQuery()` → `UseQueryResult<LanguageOut[]>` (staleTime ∞).
  - `useEntriesQuery(language: string | null)` → infinite query whose `data` is the flattened `EntrySummaryOut[]`; `fetchNextPage`, `hasNextPage`, `isFetchingNextPage`, `isFetchNextPageError`.
  - `useEntryQuery(id: string | null)` → `UseQueryResult<EntryDetailOut>`; idle (`skipToken`) while `id` is null.
  - `useAnalysesQuery(entryId: string)` → `UseQueryResult<AnalysisOut[]>` (newest first).
  - `useCreateEntryMutation()` → `mutate(EntryCreate)`; seeds `journalKeys.entry(id)` with `{...entry, latest_analysis: null}`; invalidates `entryLists`.
  - `useUpdateEntryMutation()` → `mutate({ id, text })`; merges into the cached detail; invalidates `entryLists`.
  - `useRunAnalysisMutation()` → `mutate(entryId)` → `AnalysisOut`; sets it as the cached detail's `latest_analysis`, prepends it to the cached history, invalidates `analyses(id)` and `entryLists`.
  - `AppProviders({ children })`; test helpers `renderWithProviders(ui) → { client, ...RenderResult }`, `renderHookWithProviders(hook) → { client, ...RenderHookResult }`.

- [ ] **Step 1: Install TanStack Query (ask the human first)**

Run (inside `frontend/`): `pnpm add @tanstack/react-query@5.104.0`

- [ ] **Step 2: Test helper for rendering with a fresh cache**

`frontend/src/test/renderWithProviders.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, renderHook } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'

/** Fresh cache per test, no retries — so error states render immediately. */
function createTestClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

function Providers({ client, children }: { client: QueryClient; children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

export function renderWithProviders(ui: ReactElement) {
  const client = createTestClient()
  return { client, ...render(<Providers client={client}>{ui}</Providers>) }
}

export function renderHookWithProviders<T>(hook: () => T) {
  const client = createTestClient()
  const wrapper = ({ children }: { children: ReactNode }) => <Providers client={client}>{children}</Providers>
  return { client, ...renderHook(hook, { wrapper }) }
}
```

- [ ] **Step 3: Write the failing hook tests**

`frontend/src/hooks/queries/queries.test.tsx`:
```tsx
import { act, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SEEDED } from '@/mocks/seed'
import { setMockMode } from '@/test/helpers'
import { renderHookWithProviders } from '@/test/renderWithProviders'
import { toErrorMessage } from '@/utils/errorMessage'
import { useAnalysesQuery } from './useAnalysesQuery'
import { useEntriesQuery } from './useEntriesQuery'
import { useEntryQuery } from './useEntryQuery'
import { useLanguagesQuery } from './useLanguagesQuery'

describe('query hooks', () => {
  it('lists the supported languages', async () => {
    // Arrange
    const { result } = renderHookWithProviders(() => useLanguagesQuery())
    // Act
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // Assert
    expect(result.current.data?.map((language) => language.code)).toEqual(['es', 'fr', 'de', 'it', 'pt'])
  })

  it('loads entries a page at a time until the cursor runs out', async () => {
    // Arrange
    const { result } = renderHookWithProviders(() => useEntriesQuery(null))
    await waitFor(() => expect(result.current.data).toHaveLength(10))
    // Act
    await act(() => result.current.fetchNextPage())
    // Assert
    await waitFor(() => expect(result.current.data).toHaveLength(14))
    expect(result.current.hasNextPage).toBe(false)
  })

  it('filters entries by language', async () => {
    // Arrange
    const { result } = renderHookWithProviders(() => useEntriesQuery('fr'))
    // Act
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // Assert
    expect(result.current.data?.map((entry) => entry.language)).toEqual(['fr', 'fr', 'fr', 'fr'])
  })

  it('waits for an id before fetching an entry', () => {
    // Arrange
    const id = null
    // Act
    const { result } = renderHookWithProviders(() => useEntryQuery(id))
    // Assert
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('loads an entry with its latest analysis', async () => {
    // Arrange
    const { result } = renderHookWithProviders(() => useEntryQuery(SEEDED.revisedFrench))
    // Act
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // Assert
    expect(result.current.data?.latest_analysis?.feedback_summary).toBe('Great job — no mistakes found!')
  })

  it('lists past analyses newest first', async () => {
    // Arrange
    const { result } = renderHookWithProviders(() => useAnalysesQuery(SEEDED.revisedFrench))
    // Act
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // Assert
    expect(result.current.data?.map((analysis) => analysis.mistakes.length)).toEqual([0, 1])
  })

  it('surfaces a server failure that reads as a human message', async () => {
    // Arrange
    setMockMode('error')
    const { result } = renderHookWithProviders(() => useLanguagesQuery())
    // Act
    await waitFor(() => expect(result.current.isError).toBe(true))
    // Assert
    expect(toErrorMessage(result.current.error)).toMatch(/^Something went wrong on our side/)
  })
})
```

`frontend/src/hooks/mutations/mutations.test.tsx`:
```tsx
import { act, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { journalKeys } from '@/hooks/queries/journalKeys'
import { useAnalysesQuery } from '@/hooks/queries/useAnalysesQuery'
import { useEntriesQuery } from '@/hooks/queries/useEntriesQuery'
import { useEntryQuery } from '@/hooks/queries/useEntryQuery'
import { SEEDED } from '@/mocks/seed'
import { renderHookWithProviders } from '@/test/renderWithProviders'
import { useCreateEntryMutation } from './useCreateEntryMutation'
import { useRunAnalysisMutation } from './useRunAnalysisMutation'
import { useUpdateEntryMutation } from './useUpdateEntryMutation'

describe('mutation hooks', () => {
  it('creating an entry seeds its detail so the Write screen needs no refetch', async () => {
    // Arrange
    const { result, client } = renderHookWithProviders(() => useCreateEntryMutation())
    // Act
    const entry = await act(() => result.current.mutateAsync({ language: 'es', text: 'Hola mundo' }))
    // Assert
    expect(client.getQueryData(journalKeys.entry(entry.id))).toMatchObject({ text: 'Hola mundo', latest_analysis: null })
  })

  it('creating an entry puts it at the top of the history list', async () => {
    // Arrange
    const { result } = renderHookWithProviders(() => ({ list: useEntriesQuery(null), create: useCreateEntryMutation() }))
    await waitFor(() => expect(result.current.list.data).toHaveLength(10))
    // Act
    const entry = await act(() => result.current.create.mutateAsync({ language: 'es', text: 'Hola mundo' }))
    // Assert
    await waitFor(() => expect(result.current.list.data?.[0]?.id).toBe(entry.id))
  })

  it('running an analysis makes it the entry’s latest and the newest in its history', async () => {
    // Arrange
    const id = SEEDED.unanalysed
    const { result } = renderHookWithProviders(() => ({
      entry: useEntryQuery(id),
      analyses: useAnalysesQuery(id),
      analyze: useRunAnalysisMutation(),
    }))
    await waitFor(() => expect(result.current.entry.isSuccess && result.current.analyses.isSuccess).toBe(true))
    // Act
    const analysis = await act(() => result.current.analyze.mutateAsync(id))
    // Assert
    await waitFor(() => expect(result.current.entry.data?.latest_analysis?.id).toBe(analysis.id))
    expect(result.current.analyses.data?.[0]?.id).toBe(analysis.id)
  })

  it('updating an entry keeps its cached detail in sync', async () => {
    // Arrange
    const id = SEEDED.unanalysed
    const { result } = renderHookWithProviders(() => ({ entry: useEntryQuery(id), update: useUpdateEntryMutation() }))
    await waitFor(() => expect(result.current.entry.isSuccess).toBe(true))
    // Act
    await act(() => result.current.update.mutateAsync({ id, text: 'Escribo esto antes de dormir hoy.' }))
    // Assert
    await waitFor(() =>
      expect(result.current.entry.data).toMatchObject({ text: 'Escribo esto antes de dormir hoy.', word_count: 6 }),
    )
  })
})
```

Run: `pnpm -C frontend test src/hooks`
Expected: FAIL — unresolved imports (`./useLanguagesQuery`, …).

- [ ] **Step 4: Implement keys, queries and mutations**

Add to `frontend/src/utils/constants.ts`:
```ts
export const PAGE_SIZE = 10
```

`frontend/src/hooks/queries/journalKeys.ts`:
```ts
// Query-key factory shared by queries and mutations. `entry(id)` prefixes `analyses(id)`, so one invalidation covers both.
export const journalKeys = {
  languages: ['languages'] as const,
  entryLists: ['entries', 'list'] as const,
  entryList: (language: string | null) => ['entries', 'list', { language }] as const,
  entry: (id: string) => ['entries', 'detail', id] as const,
  analyses: (id: string) => ['entries', 'detail', id, 'analyses'] as const,
}
```

`frontend/src/hooks/queries/useLanguagesQuery.ts`:
```ts
import { useQuery } from '@tanstack/react-query'
import type { LanguageOut } from '@/types/language'
import { client } from '@/utils/client'
import { ENDPOINTS } from '@/utils/endpoints'
import { journalKeys } from './journalKeys'

export function useLanguagesQuery() {
  return useQuery({
    queryKey: journalKeys.languages,
    queryFn: () => client.get(ENDPOINTS.languages).json<LanguageOut[]>(),
    // The supported list only changes with a deploy.
    staleTime: Infinity,
  })
}
```

`frontend/src/hooks/queries/useEntriesQuery.ts`:
```ts
import { useInfiniteQuery } from '@tanstack/react-query'
import type { EntryPageOut } from '@/types/entry'
import { client } from '@/utils/client'
import { PAGE_SIZE } from '@/utils/constants'
import { ENDPOINTS } from '@/utils/endpoints'
import { journalKeys } from './journalKeys'

function listParams(language: string | null, cursor: string | undefined): Record<string, string | number> {
  const params: Record<string, string | number> = { limit: PAGE_SIZE }
  if (language) params.language = language
  if (cursor) params.cursor = cursor
  return params
}

export function useEntriesQuery(language: string | null) {
  return useInfiniteQuery({
    queryKey: journalKeys.entryList(language),
    queryFn: ({ pageParam }) =>
      client.get(ENDPOINTS.entries, { searchParams: listParams(language, pageParam) }).json<EntryPageOut>(),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    select: (data) => data.pages.flatMap((page) => page.items),
  })
}
```

`frontend/src/hooks/queries/useEntryQuery.ts`:
```ts
import { skipToken, useQuery } from '@tanstack/react-query'
import type { EntryDetailOut } from '@/types/entry'
import { client } from '@/utils/client'
import { ENDPOINTS } from '@/utils/endpoints'
import { journalKeys } from './journalKeys'

export function useEntryQuery(id: string | null) {
  return useQuery({
    queryKey: journalKeys.entry(id ?? ''),
    queryFn: id ? () => client.get(ENDPOINTS.entry(id)).json<EntryDetailOut>() : skipToken,
  })
}
```

`frontend/src/hooks/queries/useAnalysesQuery.ts`:
```ts
import { useQuery } from '@tanstack/react-query'
import type { AnalysisOut } from '@/types/analysis'
import { client } from '@/utils/client'
import { ENDPOINTS } from '@/utils/endpoints'
import { journalKeys } from './journalKeys'

export function useAnalysesQuery(entryId: string) {
  return useQuery({
    queryKey: journalKeys.analyses(entryId),
    queryFn: () => client.get(ENDPOINTS.analyses(entryId)).json<AnalysisOut[]>(),
  })
}
```

`frontend/src/hooks/mutations/useCreateEntryMutation.ts`:
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { journalKeys } from '@/hooks/queries/journalKeys'
import type { EntryCreate, EntryDetailOut, EntryOut } from '@/types/entry'
import { client } from '@/utils/client'
import { ENDPOINTS } from '@/utils/endpoints'

// No optimistic insert: the server normalises the text and counts words, and feedback must come from it anyway.
export function useCreateEntryMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: EntryCreate) => client.post(ENDPOINTS.entries, { json: body }).json<EntryOut>(),
    onSuccess: (entry) => {
      queryClient.setQueryData<EntryDetailOut>(journalKeys.entry(entry.id), { ...entry, latest_analysis: null })
      void queryClient.invalidateQueries({ queryKey: journalKeys.entryLists })
    },
  })
}
```

`frontend/src/hooks/mutations/useUpdateEntryMutation.ts`:
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { journalKeys } from '@/hooks/queries/journalKeys'
import type { EntryDetailOut, EntryOut, EntryUpdate } from '@/types/entry'
import { client } from '@/utils/client'
import { ENDPOINTS } from '@/utils/endpoints'

interface UpdateEntryVariables {
  id: string
  text: string
}

export function useUpdateEntryMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, text }: UpdateEntryVariables) =>
      client.patch(ENDPOINTS.entry(id), { json: { text } satisfies EntryUpdate }).json<EntryOut>(),
    onSuccess: (entry) => {
      queryClient.setQueryData<EntryDetailOut>(journalKeys.entry(entry.id), (old) => old && { ...old, ...entry })
      void queryClient.invalidateQueries({ queryKey: journalKeys.entryLists })
    },
  })
}
```

`frontend/src/hooks/mutations/useRunAnalysisMutation.ts`:
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { journalKeys } from '@/hooks/queries/journalKeys'
import type { AnalysisOut } from '@/types/analysis'
import type { EntryDetailOut } from '@/types/entry'
import { client } from '@/utils/client'
import { ENDPOINTS } from '@/utils/endpoints'

// A failed model call still resolves (201, status "failed"); only transport errors reject.
export function useRunAnalysisMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (entryId: string) => client.post(ENDPOINTS.analyses(entryId)).json<AnalysisOut>(),
    onSuccess: (analysis) => {
      const id = analysis.entry_id
      // Written straight into the cache so the new feedback shows without a flash of the previous analysis.
      queryClient.setQueryData<EntryDetailOut>(journalKeys.entry(id), (old) => old && { ...old, latest_analysis: analysis })
      queryClient.setQueryData<AnalysisOut[]>(journalKeys.analyses(id), (old) => old && [analysis, ...old])
      void queryClient.invalidateQueries({ queryKey: journalKeys.analyses(id) })
      void queryClient.invalidateQueries({ queryKey: journalKeys.entryLists })
    },
  })
}
```

Run: `pnpm -C frontend test src/hooks`
Expected: PASS.

- [ ] **Step 5: Provide the app's QueryClient**

`frontend/src/providers/AppProviders.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } })

export function AppProviders({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
```

In `frontend/src/main.tsx`: add `import { AppProviders } from './providers/AppProviders'` and wrap `<App />` as `<AppProviders><App /></AppProviders>` inside `<StrictMode>`.

In `frontend/src/App.test.tsx`: replace `import { render, screen } from '@testing-library/react'` with `import { screen } from '@testing-library/react'` plus `import { renderWithProviders } from '@/test/renderWithProviders'`, and `render(<App />)` with `renderWithProviders(<App />)`.

- [ ] **Step 6: Gates**

Run: `make verify`
Expected: `ALL GATES GREEN`.

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml frontend/src/utils/constants.ts frontend/src/hooks \
  frontend/src/providers frontend/src/test/renderWithProviders.tsx frontend/src/main.tsx frontend/src/App.test.tsx
git commit -m "feat(frontend): query and mutation hooks for languages, entries and analyses" \
  -m "@tanstack/react-query@5.104.0: server-state cache with loading/error states, cursor paging and invalidation after writes."
```

---

### Task 3: Routing, app shell and the not-found page

**Files:**
- Modify: `frontend/package.json`, `frontend/pnpm-lock.yaml` (+ `react-router`)
- Create: `frontend/src/AppRoutes.tsx`, `frontend/src/features/shell/AppShell.tsx`
- Create: `frontend/src/pages/WritePage.tsx`, `HistoryPage.tsx`, `EntryDetailPage.tsx`, `NotFoundPage.tsx`
- Create: `frontend/src/components/ui/TextLink/{TextLink.tsx,TextLink.test.tsx,index.ts}`
- Modify: `frontend/src/App.tsx`, `frontend/src/test/renderWithProviders.tsx`, `frontend/index.html`, `frontend/src/utils/monitoring.test.ts`, `frontend/e2e/smoke.spec.ts`, `frontend/DESIGN.md`
- Delete: `frontend/src/App.test.tsx` (replaced by `AppRoutes.test.tsx`), `frontend/src/features/.gitkeep`, `frontend/src/components/ui/.gitkeep`
- Test: `frontend/src/AppRoutes.test.tsx`, `frontend/src/components/ui/TextLink/TextLink.test.tsx`

**Interfaces:**
- Consumes: `AppProviders`, test helpers (Task 2).
- Produces:
  - Routes: layout `AppShell` → `/` `WritePage`, `/entries` `HistoryPage`, `/entries/:entryId` `EntryDetailPage`, `*` `NotFoundPage`. Each page renders a React 19 `<title>` and an `h1` ("Write", "History", "Entry", "Page not found"); features render `h2` and below.
  - `AppShell`: skip link "Skip to content" → `#main`, brand link "Language Journal", `nav[aria-label=Main]` with `NAV_ITEMS` (P4 adds Insights as one array item), `<main id="main" tabIndex={-1}>`.
  - `TextLink(props: LinkProps)` from `@/components/ui/TextLink`.
  - `renderWithProviders(ui, { route?: string })` now wraps a `MemoryRouter`; `renderHookWithProviders` unchanged in signature.

- [ ] **Step 1: Install React Router (ask the human first)**

Run (inside `frontend/`): `pnpm add react-router@8.4.0`
(Verified: 8.4.0 is `latest`; peer `react >=19.2.7`, engines `node >=22.22.0`; declarative `BrowserRouter`/`Routes`/`Route`/`NavLink`/`MemoryRouter`/`useParams`/`useSearchParams` are exported from `react-router`.)

- [ ] **Step 2: Router-aware test helper**

Replace `frontend/src/test/renderWithProviders.tsx` with:
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, renderHook } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter } from 'react-router'

/** Fresh cache per test, no retries — so error states render immediately. */
function createTestClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

function Providers({ client, route, children }: { client: QueryClient; route: string; children: ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

export function renderWithProviders(ui: ReactElement, { route = '/' }: { route?: string } = {}) {
  const client = createTestClient()
  return { client, ...render(<Providers client={client} route={route}>{ui}</Providers>) }
}

export function renderHookWithProviders<T>(hook: () => T) {
  const client = createTestClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Providers client={client} route="/">
      {children}
    </Providers>
  )
  return { client, ...renderHook(hook, { wrapper }) }
}
```

- [ ] **Step 3: Write the failing route and primitive tests**

`frontend/src/AppRoutes.test.tsx`:
```tsx
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/renderWithProviders'
import { AppRoutes } from './AppRoutes'

describe('routes', () => {
  it('opens Write at the root and marks it current in the navigation', () => {
    // Arrange
    const route = '/'
    // Act
    renderWithProviders(<AppRoutes />, { route })
    // Assert
    expect(screen.getByRole('heading', { level: 1, name: 'Write' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Write' })).toHaveAttribute('aria-current', 'page')
  })

  it('opens History at /entries', () => {
    // Arrange
    const route = '/entries'
    // Act
    renderWithProviders(<AppRoutes />, { route })
    // Assert
    expect(screen.getByRole('heading', { level: 1, name: 'History' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Write' })).not.toHaveAttribute('aria-current')
  })

  it('opens an entry at /entries/:entryId', () => {
    // Arrange
    const route = '/entries/entry-es-emoji'
    // Act
    renderWithProviders(<AppRoutes />, { route })
    // Assert
    expect(screen.getByRole('heading', { level: 1, name: 'Entry' })).toBeInTheDocument()
  })

  it('shows a not-found page with a way back for unknown paths', () => {
    // Arrange
    const route = '/nowhere'
    // Act
    renderWithProviders(<AppRoutes />, { route })
    // Assert
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to writing' })).toHaveAttribute('href', '/')
  })

  it('offers a skip link to the main content', () => {
    // Arrange
    const route = '/'
    // Act
    renderWithProviders(<AppRoutes />, { route })
    // Assert
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main')
  })
})
```

`frontend/src/components/ui/TextLink/TextLink.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { TextLink } from '.'

describe('TextLink', () => {
  it('renders a router link to its target', () => {
    // Arrange
    const to = '/entries'
    // Act
    render(
      <MemoryRouter>
        <TextLink to={to}>History</TextLink>
      </MemoryRouter>,
    )
    // Assert
    expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute('href', '/entries')
  })

  it('lets callers add classes after its own', () => {
    // Arrange
    const extra = 'text-sm'
    // Act
    render(
      <MemoryRouter>
        <TextLink to="/" className={extra}>
          Home
        </TextLink>
      </MemoryRouter>,
    )
    // Assert
    expect(screen.getByRole('link', { name: 'Home' })).toHaveClass('text-primary', 'text-sm')
  })
})
```

In `frontend/src/utils/monitoring.test.ts`, replace the `dataCollection: expect.objectContaining({ userInfo: false, cookies: false })` line with the exact object so a new data category can't slip in:
```ts
        dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
```

Run: `pnpm -C frontend test src/AppRoutes.test.tsx src/components/ui/TextLink src/utils/monitoring.test.ts`
Expected: route and TextLink tests FAIL (unresolved `./AppRoutes`, `.`); the monitoring test PASSES already (it pins the existing behaviour).

- [ ] **Step 4: Implement the primitive, shell, pages and routes**

`frontend/src/components/ui/TextLink/TextLink.tsx`:
```tsx
import { Link, type LinkProps } from 'react-router'
import { cn } from '@/utils/utils'

export function TextLink({ className, ...rest }: LinkProps) {
  return <Link className={cn('font-medium text-primary underline underline-offset-4 hover:no-underline', className)} {...rest} />
}
```

`frontend/src/components/ui/TextLink/index.ts`:
```ts
export { TextLink } from './TextLink'
```

`frontend/src/features/shell/AppShell.tsx`:
```tsx
import { Link, NavLink, Outlet } from 'react-router'

// One list so a later phase adds a section (Insights) as one item.
const NAV_ITEMS = [
  { to: '/', label: 'Write', end: true },
  { to: '/entries', label: 'History', end: false },
] as const

const navLinkClass =
  'inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-muted hover:text-fg aria-[current=page]:bg-surface aria-[current=page]:text-fg'
const skipLinkClass =
  'sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-toast focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-contrast'

export function AppShell() {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <a href="#main" className={skipLinkClass}>
        Skip to content
      </a>
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-2 px-4 py-2">
          <Link to="/" className="text-lg font-bold">
            Language Journal
          </Link>
          <nav aria-label="Main">
            <ul className="flex gap-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} end={item.end} className={navLinkClass}>
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-content px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
```

`frontend/src/pages/WritePage.tsx`:
```tsx
export function WritePage() {
  return (
    <div className="flex flex-col gap-6">
      <title>Write · Language Journal</title>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Write</h1>
        <p className="text-muted">Write freely in the language you are learning, then get feedback.</p>
      </div>
    </div>
  )
}
```

`frontend/src/pages/HistoryPage.tsx`:
```tsx
export function HistoryPage() {
  return (
    <div className="flex flex-col gap-6">
      <title>History · Language Journal</title>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">History</h1>
        <p className="text-muted">Every entry you have written, newest first.</p>
      </div>
    </div>
  )
}
```

`frontend/src/pages/EntryDetailPage.tsx`:
```tsx
export function EntryDetailPage() {
  return (
    <div className="flex flex-col gap-6">
      <title>Entry · Language Journal</title>
      <h1 className="text-2xl font-bold">Entry</h1>
    </div>
  )
}
```

`frontend/src/pages/NotFoundPage.tsx`:
```tsx
import { TextLink } from '@/components/ui/TextLink'

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-start gap-4">
      <title>Page not found · Language Journal</title>
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-muted">That page does not exist.</p>
      <TextLink to="/">Back to writing</TextLink>
    </div>
  )
}
```

`frontend/src/AppRoutes.tsx`:
```tsx
import { Route, Routes } from 'react-router'
import { AppShell } from '@/features/shell/AppShell'
import { EntryDetailPage } from '@/pages/EntryDetailPage'
import { HistoryPage } from '@/pages/HistoryPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { WritePage } from '@/pages/WritePage'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<WritePage />} />
        <Route path="entries" element={<HistoryPage />} />
        <Route path="entries/:entryId" element={<EntryDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
```

Replace `frontend/src/App.tsx` with:
```tsx
import { BrowserRouter } from 'react-router'
import { AppRoutes } from './AppRoutes'

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
```

Delete the old shell test and the placeholders: `git rm frontend/src/App.test.tsx frontend/src/features/.gitkeep frontend/src/components/ui/.gitkeep`.

In `frontend/index.html` replace `<meta name="description" content="App" />` with:
```html
    <meta name="description" content="Write journal entries in the language you are learning and get clear feedback on grammar, word choice and vocabulary." />
```

In `frontend/DESIGN.md`, replace the placeholder row `| _(empty — filled as primitives are created; list them here)_ | | |` with:
```
| `TextLink` | — | React Router `Link` in the primary role, underlined; `className` merges last |
```

Run: `pnpm -C frontend test`
Expected: PASS.

- [ ] **Step 5: Update the smoke e2e**

Replace `frontend/e2e/smoke.spec.ts` with:
```ts
import { expect, test } from '@playwright/test'
import { expectNoA11yViolations } from './a11y'
import { expectButtonsShowPointer } from './cursor'

test('the app shell loads with the brand, the Write page and no a11y violations', async ({ page }) => {
  // Arrange
  await page.goto('/')
  // Act
  const heading = page.getByRole('heading', { level: 1 })
  // Assert
  await expect(page.getByRole('link', { name: 'Language Journal' })).toBeVisible()
  await expect(heading).toHaveText('Write')
  await expect(page).toHaveTitle('Write · Language Journal')
  await expectNoA11yViolations(page)
  await expectButtonsShowPointer(page)
})

test('the main navigation reaches History', async ({ page }) => {
  // Arrange
  await page.goto('/')
  // Act
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'History' }).click()
  // Assert
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('History')
  await expectNoA11yViolations(page)
})

test('unknown paths show a not-found page with a way back', async ({ page }) => {
  // Arrange
  await page.goto('/nowhere')
  // Act
  await page.getByRole('link', { name: 'Back to writing' }).click()
  // Assert
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Write')
})
```

- [ ] **Step 6: Gates**

Run: `make verify`
Expected: `ALL GATES GREEN` — Lighthouse SEO now sees a real description.

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml frontend/src/AppRoutes.tsx frontend/src/AppRoutes.test.tsx \
  frontend/src/App.tsx frontend/src/features/shell frontend/src/pages frontend/src/components/ui/TextLink \
  frontend/src/test/renderWithProviders.tsx frontend/index.html frontend/src/utils/monitoring.test.ts \
  frontend/e2e/smoke.spec.ts frontend/DESIGN.md
git commit -m "feat(frontend): routes, app shell with skip link and navigation, not-found page" \
  -m "react-router@8.4.0: three routes under one layout with the History filter kept in the URL; current major (React >=19.2.7)."
```
(`git rm` in Step 4 already staged the deletions.)

---

### Task 4: FeedbackView — annotated text, detail panel, corrected toggle, other notes

**Files:**
- Modify: `frontend/src/styles/tokens.css`, `frontend/DESIGN.md`
- Create: `frontend/src/components/ui/Button/{Button.tsx,Button.test.tsx,index.ts}`, `frontend/src/components/ui/Badge/{Badge.tsx,Badge.test.tsx,index.ts}`, `frontend/src/components/ui/ErrorState/{ErrorState.tsx,ErrorState.test.tsx,index.ts}`
- Create: `frontend/src/hooks/misc/useEscapeKey.ts`, `frontend/src/hooks/misc/useEscapeKey.test.ts`
- Create: `frontend/src/features/feedback/segmentText.ts`, `labels.ts`, `markClasses.ts`, `Correction.tsx`, `AnnotatedText.tsx`, `MistakePanel.tsx`, `Legend.tsx`, `OtherNotes.tsx`, `FeedbackView.tsx`, `AnalysisFailure.tsx`
- Test: `frontend/src/features/feedback/segmentText.test.ts`, `labels.test.ts`, `FeedbackView.test.tsx`, `FeedbackView.panel.test.tsx`, `AnalysisFailure.test.tsx`

**Interfaces:**
- Consumes: `AnalysisOut`, `MistakeOut`, `MistakeKind`, `Category`, `FailureCode` (Task 1); `buildAnalysis`, `buildMistake` (Task 1, test data); `toErrorMessage` (Task 1); `cn`.
- Produces:
  - `Button(props: ComponentProps<'button'> & { variant?: 'primary' | 'secondary' | 'ghost' | 'inline' })` — default `secondary`, `type="button"`.
  - `Badge(props: ComponentProps<'span'> & { tone?: 'neutral' | 'danger' | 'success' | 'warning' })`.
  - `ErrorState({ message: string, onRetry: () => void, retryLabel?: string, retrying?: boolean })` — `role="alert"`, default label "Try again".
  - `useEscapeKey(onEscape: () => void): void` (`hooks/misc`).
  - `PlacedMistake = MistakeOut & { start: number; end: number }`; `Segment = { text: string; mistake: PlacedMistake | null }`; `placeMistakes(text, mistakes) → { placed: PlacedMistake[]; unplaced: MistakeOut[] }`; `segmentText(text, placed) → Segment[]`.
  - `KIND_LABELS: Record<MistakeKind, string>` ("Error", "Suggestion", "Word help"); `categoryLabel(category): string`; `failureMessage(code: FailureCode | null): string`.
  - `FeedbackView({ analysis: AnalysisOut, actions?: ReactNode })` — callers key it by `analysis.id`.
  - `AnalysisFailure({ analysis: AnalysisOut | null, requestError: unknown, isRetrying: boolean, onRetry: () => void })`.
  - Accessible names later tasks rely on: section heading "Feedback"; highlight buttons "`<snippet>` (error|suggestion|word help)"; panel region named by its heading "`<original>` should be `<correction>`"; toggle "Show corrected version" with `aria-pressed`; region "Other notes"; list "Feedback legend"; retry button "Retry analysis".

- [ ] **Step 1: Add the highlight tokens**

In `frontend/src/styles/tokens.css`, inside `@theme` after `--color-scrim`:
```css
  --color-mark-error: #b91c1c;
  --color-mark-error-bg: #fef2f2;
  --color-mark-suggestion: #92400e;
  --color-mark-suggestion-bg: #fffbeb;
  --color-mark-vocab: #6d28d9;
  --color-mark-vocab-bg: #f5f3ff;
```
and inside the dark `:root` after `--color-scrim`:
```css
    --color-mark-error: #f87171;
    --color-mark-error-bg: #3b1219;
    --color-mark-suggestion: #fbbf24;
    --color-mark-suggestion-bg: #3a2a0a;
    --color-mark-vocab: #c4b5fd;
    --color-mark-vocab-bg: #2e1f5e;
```

In `frontend/DESIGN.md`, add a token row after "Color roles":
```
| Feedback marks | `--color-mark-error`, `mark-suggestion`, `mark-vocab` (+ `-bg` tints) | `bg-mark-error-bg decoration-mark-error` — kind is shown by colour **and** underline style (error wavy, suggestion dashed, word help dotted) |
```
and below the table:
```
Mark contrast (computed): text `fg` on each tint ≥12.6:1; underline colour on its tint ≥5.9:1 (light) / ≥5.9:1 (dark) — above the 4.5:1 text and 3:1 non-text bars.
```

- [ ] **Step 2: Write the failing primitive and pure-function tests**

`frontend/src/components/ui/Button/Button.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '.'

describe('Button', () => {
  it('never submits a form by accident', () => {
    // Arrange
    const label = 'Save'
    // Act
    render(<Button>{label}</Button>)
    // Assert
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button')
  })

  it('applies the chosen variant and keeps the pointer cursor', () => {
    // Arrange
    const variant = 'primary'
    // Act
    render(<Button variant={variant}>Go</Button>)
    // Assert
    expect(screen.getByRole('button', { name: 'Go' })).toHaveClass('bg-primary', 'cursor-pointer', 'min-h-11')
  })

  it('does not fire when disabled', async () => {
    // Arrange
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Go
      </Button>,
    )
    // Act
    await userEvent.setup().click(screen.getByRole('button', { name: 'Go' }))
    // Assert
    expect(onClick).not.toHaveBeenCalled()
  })
})
```

`frontend/src/components/ui/Badge/Badge.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Badge } from '.'

describe('Badge', () => {
  it('shows its label in the chosen tone', () => {
    // Arrange
    const tone = 'danger'
    // Act
    render(<Badge tone={tone}>2 errors</Badge>)
    // Assert
    expect(screen.getByText('2 errors')).toHaveClass('text-danger')
  })

  it('defaults to the neutral tone', () => {
    // Arrange
    const label = 'Verb conjugation'
    // Act
    render(<Badge>{label}</Badge>)
    // Assert
    expect(screen.getByText(label)).toHaveClass('text-muted')
  })
})
```

`frontend/src/components/ui/ErrorState/ErrorState.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ErrorState } from '.'

describe('ErrorState', () => {
  it('announces the message and retries on request', async () => {
    // Arrange
    const onRetry = vi.fn()
    render(<ErrorState message="Could not load." onRetry={onRetry} />)
    // Act
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))
    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load.')
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('disables its button while a retry is running', () => {
    // Arrange
    const retrying = true
    // Act
    render(<ErrorState message="Failed." onRetry={vi.fn()} retryLabel="Retrying…" retrying={retrying} />)
    // Assert
    expect(screen.getByRole('button', { name: 'Retrying…' })).toBeDisabled()
  })
})
```

`frontend/src/hooks/misc/useEscapeKey.test.ts`:
```ts
import { fireEvent, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useEscapeKey } from './useEscapeKey'

describe('useEscapeKey', () => {
  it('calls the handler when Escape is pressed anywhere', () => {
    // Arrange
    const onEscape = vi.fn()
    renderHook(() => useEscapeKey(onEscape))
    // Act
    fireEvent.keyDown(document, { key: 'Escape' })
    // Assert
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  it('ignores other keys', () => {
    // Arrange
    const onEscape = vi.fn()
    renderHook(() => useEscapeKey(onEscape))
    // Act
    fireEvent.keyDown(document, { key: 'Enter' })
    // Assert
    expect(onEscape).not.toHaveBeenCalled()
  })

  it('stops listening once unmounted', () => {
    // Arrange
    const onEscape = vi.fn()
    const { unmount } = renderHook(() => useEscapeKey(onEscape))
    unmount()
    // Act
    fireEvent.keyDown(document, { key: 'Escape' })
    // Assert
    expect(onEscape).not.toHaveBeenCalled()
  })
})
```

`frontend/src/features/feedback/segmentText.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { buildMistake } from '@/mocks/factories'
import { placeMistakes, segmentText } from './segmentText'

const parts = (text: string, mistakes: ReturnType<typeof buildMistake>[]) =>
  segmentText(text, placeMistakes(text, mistakes).placed).map((s) => [s.text, s.mistake?.id ?? null])

describe('placeMistakes + segmentText', () => {
  it('splits the text around a mistake', () => {
    // Arrange
    const mistake = buildMistake({ id: 'm', start: 5, end: 10 })
    // Act
    const result = parts('Ayer yo es feliz.', [mistake])
    // Assert
    expect(result).toEqual([['Ayer ', null], ['yo es', 'm'], [' feliz.', null]])
  })

  it('counts an emoji as one code point, as the API does', () => {
    // Arrange
    const mistake = buildMistake({ id: 'm', start: 6, end: 11 })
    // Act
    const result = parts('Hoy 😀 yo es feliz.', [mistake])
    // Assert
    expect(result).toEqual([['Hoy 😀 ', null], ['yo es', 'm'], [' feliz.', null]])
  })

  it('keeps accented letters intact', () => {
    // Arrange
    const mistake = buildMistake({ id: 'm', original: 'à le', start: 13, end: 17 })
    // Act
    const result = parts('Je suis allé à le marché.', [mistake])
    // Assert
    expect(result).toEqual([['Je suis allé ', null], ['à le', 'm'], [' marché.', null]])
  })

  it('renders adjacent spans without an empty gap', () => {
    // Arrange
    const mistakes = [buildMistake({ id: 'b', start: 3, end: 6 }), buildMistake({ id: 'a', start: 0, end: 3 })]
    // Act
    const result = parts('abcdef', mistakes)
    // Assert
    expect(result).toEqual([['abc', 'a'], ['def', 'b']])
  })

  it.each([
    ['null offsets', { start: null, end: null }],
    ['an end past the text', { start: 5, end: 99 }],
    ['an empty span', { start: 5, end: 5 }],
    ['a negative start', { start: -1, end: 3 }],
  ])('sends a mistake with %s to the unplaced list', (_label, offsets) => {
    // Arrange
    const mistake = buildMistake({ id: 'bad', ...offsets })
    // Act
    const { placed, unplaced } = placeMistakes('Ayer yo es feliz.', [mistake])
    // Assert
    expect(placed).toEqual([])
    expect(unplaced.map((m) => m.id)).toEqual(['bad'])
  })

  it('keeps the first of two overlapping spans and lists the other as unplaced', () => {
    // Arrange
    const mistakes = [buildMistake({ id: 'first', start: 5, end: 10 }), buildMistake({ id: 'overlap', start: 8, end: 12 })]
    // Act
    const { placed, unplaced } = placeMistakes('Ayer yo es feliz.', mistakes)
    // Assert
    expect(placed.map((m) => m.id)).toEqual(['first'])
    expect(unplaced.map((m) => m.id)).toEqual(['overlap'])
  })

  it('returns the whole text as one plain segment when nothing is placed', () => {
    // Arrange
    const text = 'Está bien.'
    // Act
    const result = parts(text, [])
    // Assert
    expect(result).toEqual([['Está bien.', null]])
  })

  it('returns no segments for empty text', () => {
    // Arrange
    const text = ''
    // Act
    const result = parts(text, [])
    // Assert
    expect(result).toEqual([])
  })
})
```

`frontend/src/features/feedback/labels.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { categoryLabel, failureMessage } from './labels'

describe('labels', () => {
  it('turns a category id into words', () => {
    // Arrange
    const category = 'verb_conjugation'
    // Act
    const label = categoryLabel(category)
    // Assert
    expect(label).toBe('Verb conjugation')
  })

  it.each([
    ['provider_timeout', 'The AI took too long to respond. Your entry is saved — try again.'],
    ['invalid_output', 'The AI sent back feedback we could not read. Your entry is saved — try again.'],
    ['provider_error', 'The AI service is unavailable right now. Your entry is saved — try again.'],
    [null, 'The analysis did not finish. Your entry is saved — try again.'],
  ] as const)('explains %s and reassures that the entry is saved', (code, expected) => {
    // Arrange
    const failure = code
    // Act
    const message = failureMessage(failure)
    // Assert
    expect(message).toBe(expected)
  })
})
```

Run: `pnpm -C frontend test src/components/ui src/hooks/misc src/features/feedback`
Expected: FAIL — unresolved imports.

- [ ] **Step 3: Implement the primitives and the Escape hook**

`frontend/src/components/ui/Button/Button.tsx`:
```tsx
import type { ComponentProps } from 'react'
import { cn } from '@/utils/utils'

const variants = {
  primary: 'min-h-11 bg-primary px-4 py-2 text-sm font-medium text-primary-contrast hover:opacity-90',
  secondary: 'min-h-11 border border-border bg-surface px-4 py-2 text-sm font-medium text-fg hover:bg-bg',
  ghost: 'min-h-11 px-3 py-2 text-sm font-medium text-fg hover:bg-surface',
  // Highlights sit inside running text, so they keep the text's size and line height.
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
        'inline-flex cursor-pointer items-center justify-center gap-2 rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        className,
      )}
      {...rest}
    />
  )
}
```

`frontend/src/components/ui/Button/index.ts`:
```ts
export { Button, type ButtonProps } from './Button'
```

`frontend/src/components/ui/Badge/Badge.tsx`:
```tsx
import type { ComponentProps } from 'react'
import { cn } from '@/utils/utils'

const toneClasses = {
  neutral: 'border-border text-muted',
  danger: 'border-danger text-danger',
  success: 'border-success text-success',
  warning: 'border-warning text-warning',
} as const

export interface BadgeProps extends ComponentProps<'span'> {
  tone?: keyof typeof toneClasses
}

export function Badge({ tone = 'neutral', className, ...rest }: BadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full border bg-surface px-2 py-0.5 text-xs font-medium', toneClasses[tone], className)}
      {...rest}
    />
  )
}
```

`frontend/src/components/ui/Badge/index.ts`:
```ts
export { Badge, type BadgeProps } from './Badge'
```

`frontend/src/components/ui/ErrorState/ErrorState.tsx`:
```tsx
import { Button } from '@/components/ui/Button'

export interface ErrorStateProps {
  message: string
  onRetry: () => void
  retryLabel?: string
  retrying?: boolean
}

export function ErrorState({ message, onRetry, retryLabel = 'Try again', retrying = false }: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-md border border-danger bg-surface p-4 text-sm">
      <p>{message}</p>
      <Button onClick={onRetry} disabled={retrying}>
        {retryLabel}
      </Button>
    </div>
  )
}
```

`frontend/src/components/ui/ErrorState/index.ts`:
```ts
export { ErrorState, type ErrorStateProps } from './ErrorState'
```

`frontend/src/hooks/misc/useEscapeKey.ts`:
```ts
import { useEffect } from 'react'

// Listens on the document so Escape works wherever focus is inside the open panel.
export function useEscapeKey(onEscape: () => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onEscape()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onEscape])
}
```

In `frontend/DESIGN.md` Primitives table add:
```
| `Button` | `primary`, `secondary` (default), `ghost`, `inline` (highlights inside text) | the only raw `<button>`; `type="button"` by default; `min-h-11` touch target except `inline`; pointer / not-allowed cursor |
| `Badge` | `tone`: `neutral` (default), `danger`, `success`, `warning` | status and count chips on `bg-surface` (all tones ≥4.7:1) |
| `ErrorState` | — | `role="alert"` message + retry `Button`; `retryLabel`, `retrying` |
```

- [ ] **Step 4: Implement the pure feedback helpers**

`frontend/src/features/feedback/segmentText.ts`:
```ts
import type { MistakeOut } from '@/types/analysis'

export type PlacedMistake = MistakeOut & { start: number; end: number }
export interface Segment {
  text: string
  mistake: PlacedMistake | null
}

const LAST = Number.MAX_SAFE_INTEGER
const byStart = (a: MistakeOut, b: MistakeOut) => (a.start ?? LAST) - (b.start ?? LAST)

function fits(mistake: MistakeOut, cursor: number, length: number): mistake is PlacedMistake {
  const { start, end } = mistake
  return start !== null && end !== null && start >= cursor && start < end && end <= length
}

// Offsets are Unicode code points (spec §6). Anything that cannot be drawn safely — null, out of range, empty or
// overlapping — is returned as unplaced so the UI can still show it.
export function placeMistakes(text: string, mistakes: readonly MistakeOut[]) {
  const length = Array.from(text).length
  const placed: PlacedMistake[] = []
  const unplaced: MistakeOut[] = []
  let cursor = 0
  for (const mistake of [...mistakes].sort(byStart)) {
    if (fits(mistake, cursor, length)) {
      placed.push(mistake)
      cursor = mistake.end
    } else {
      unplaced.push(mistake)
    }
  }
  return { placed, unplaced }
}

// Expects `placed` from placeMistakes: sorted and non-overlapping.
export function segmentText(text: string, placed: readonly PlacedMistake[]): Segment[] {
  const chars = Array.from(text)
  const segments: Segment[] = []
  let cursor = 0
  for (const mistake of placed) {
    if (mistake.start > cursor) segments.push({ text: chars.slice(cursor, mistake.start).join(''), mistake: null })
    segments.push({ text: chars.slice(mistake.start, mistake.end).join(''), mistake })
    cursor = mistake.end
  }
  if (cursor < chars.length) segments.push({ text: chars.slice(cursor).join(''), mistake: null })
  return segments
}
```

`frontend/src/features/feedback/labels.ts`:
```ts
import type { Category, FailureCode, MistakeKind } from '@/types/analysis'

export const KIND_LABELS: Record<MistakeKind, string> = {
  error: 'Error',
  suggestion: 'Suggestion',
  vocab_help: 'Word help',
}

export function categoryLabel(category: Category): string {
  const words = category.replace(/_/gu, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const FAILURE_MESSAGES: Record<FailureCode, string> = {
  provider_timeout: 'The AI took too long to respond.',
  invalid_output: 'The AI sent back feedback we could not read.',
  provider_error: 'The AI service is unavailable right now.',
}

export function failureMessage(code: FailureCode | null): string {
  const reason = code ? FAILURE_MESSAGES[code] : 'The analysis did not finish.'
  return `${reason} Your entry is saved — try again.`
}
```

`frontend/src/features/feedback/markClasses.ts`:
```ts
import type { MistakeKind } from '@/types/analysis'

// Kind is encoded twice — colour and underline style — so it never relies on colour vision alone.
export const markClasses: Record<MistakeKind, string> = {
  error: 'bg-mark-error-bg underline decoration-mark-error decoration-wavy decoration-2 underline-offset-4',
  suggestion: 'bg-mark-suggestion-bg underline decoration-mark-suggestion decoration-dashed decoration-2 underline-offset-4',
  vocab_help: 'bg-mark-vocab-bg underline decoration-mark-vocab decoration-dotted decoration-2 underline-offset-4',
}
```

Run: `pnpm -C frontend test src/components/ui src/hooks/misc src/features/feedback/segmentText.test.ts src/features/feedback/labels.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing FeedbackView and AnalysisFailure tests**

`frontend/src/features/feedback/FeedbackView.test.tsx`:
```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { buildAnalysis, buildMistake } from '@/mocks/factories'
import { FeedbackView } from './FeedbackView'

// Code points: H o y ␠ 😀 ␠ → "yo es" starts at 6; "[park]" spans 24–30.
const analysis = buildAnalysis({
  input_text: 'Hoy 😀 yo es feliz en el [park].',
  corrected_text: 'Hoy 😀 yo soy feliz en el parque.',
  feedback_summary: 'Good effort! 3 things to look at.',
  mistakes: [
    buildMistake({ id: 'm-error', start: 6, end: 11 }),
    buildMistake({ id: 'm-vocab', kind: 'vocab_help', category: 'vocabulary', original: '[park]', correction: 'parque', explanation: 'Here is the word you were looking for.', start: 24, end: 30 }),
    buildMistake({ id: 'm-note', kind: 'suggestion', category: 'other', original: 'feliz en el', correction: 'contento en el', explanation: 'Overlaps another highlight.', start: null, end: null }),
  ],
})

describe('FeedbackView', () => {
  it('shows the summary and turns each placed mistake into a highlight button', () => {
    // Arrange
    const props = { analysis }
    // Act
    render(<FeedbackView {...props} />)
    // Assert
    expect(screen.getByRole('heading', { name: 'Feedback' })).toBeInTheDocument()
    expect(screen.getByText('Good effort! 3 things to look at.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'yo es (error)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '[park] (word help)' })).toBeInTheDocument()
  })

  it('encodes the kind in the underline style as well as the colour', () => {
    // Arrange
    render(<FeedbackView analysis={analysis} />)
    // Act
    const error = screen.getByRole('button', { name: /yo es/ })
    const vocab = screen.getByRole('button', { name: /park/ })
    // Assert
    expect(error).toHaveClass('decoration-wavy', 'decoration-mark-error')
    expect(vocab).toHaveClass('decoration-dotted', 'decoration-mark-vocab')
  })

  it('counts each kind in the legend', () => {
    // Arrange
    render(<FeedbackView analysis={analysis} />)
    // Act
    const legend = screen.getByRole('list', { name: 'Feedback legend' })
    // Assert
    expect(within(legend).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Error 1',
      'Suggestion 1',
      'Word help 1',
    ])
  })

  it('lists notes it cannot place under "Other notes"', () => {
    // Arrange
    render(<FeedbackView analysis={analysis} />)
    // Act
    const notes = screen.getByRole('region', { name: 'Other notes' })
    // Assert
    expect(notes).toHaveTextContent('feliz en el')
    expect(notes).toHaveTextContent('Overlaps another highlight.')
  })

  it('toggles the corrected version and hides the highlights meanwhile', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<FeedbackView analysis={analysis} />)
    const toggle = screen.getByRole('button', { name: 'Show corrected version' })
    // Act
    await user.click(toggle)
    // Assert
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Hoy 😀 yo soy feliz en el parque.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /yo es/ })).not.toBeInTheDocument()
  })

  it('says when there is nothing to correct', () => {
    // Arrange
    const clean = buildAnalysis({ mistakes: [], feedback_summary: 'Great job — no mistakes found!' })
    // Act
    render(<FeedbackView analysis={clean} />)
    // Assert
    expect(screen.getByText('Nothing to correct in this entry.')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Other notes' })).not.toBeInTheDocument()
  })

  it('renders the actions it is given', () => {
    // Arrange
    const actions = <a href="/">New entry</a>
    // Act
    render(<FeedbackView analysis={analysis} actions={actions} />)
    // Assert
    expect(screen.getByRole('link', { name: 'New entry' })).toBeInTheDocument()
  })
})
```

`frontend/src/features/feedback/FeedbackView.panel.test.tsx`:
```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { buildAnalysis } from '@/mocks/factories'
import { FeedbackView } from './FeedbackView'

const analysis = buildAnalysis()

async function openPanel() {
  const user = userEvent.setup()
  render(<FeedbackView analysis={analysis} />)
  const highlight = screen.getByRole('button', { name: /yo es/ })
  await user.click(highlight)
  return { user, highlight }
}

describe('FeedbackView detail panel', () => {
  it('shows the correction, category and explanation and moves focus into the panel', async () => {
    // Arrange + Act
    const { highlight } = await openPanel()
    // Assert
    const panel = screen.getByRole('region', { name: /yo es should be yo soy/ })
    expect(within(panel).getByText('Verb conjugation')).toBeInTheDocument()
    expect(panel).toHaveTextContent('With «yo», «ser» is conjugated «soy».')
    expect(highlight).toHaveAttribute('aria-expanded', 'true')
    expect(within(panel).getByRole('heading')).toHaveFocus()
  })

  it('closes on Escape and returns focus to the highlight', async () => {
    // Arrange
    const { user, highlight } = await openPanel()
    // Act
    await user.keyboard('{Escape}')
    // Assert
    expect(screen.queryByRole('region', { name: /should be/ })).not.toBeInTheDocument()
    expect(highlight).toHaveFocus()
    expect(highlight).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes with its Close button', async () => {
    // Arrange
    const { user, highlight } = await openPanel()
    // Act
    await user.click(screen.getByRole('button', { name: 'Close' }))
    // Assert
    expect(screen.queryByRole('region', { name: /should be/ })).not.toBeInTheDocument()
    expect(highlight).toHaveFocus()
  })

  it('opens from the keyboard', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<FeedbackView analysis={analysis} />)
    await user.tab()
    await user.tab()
    // Act
    await user.keyboard('{Enter}')
    // Assert
    expect(screen.getByRole('region', { name: /should be/ })).toBeInTheDocument()
  })
})
```

`frontend/src/features/feedback/AnalysisFailure.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { buildAnalysis } from '@/mocks/factories'
import { AnalysisFailure } from './AnalysisFailure'

describe('AnalysisFailure', () => {
  it('explains a failed analysis and retries it', async () => {
    // Arrange
    const onRetry = vi.fn()
    const failed = buildAnalysis({ status: 'failed', error_code: 'provider_timeout', mistakes: [] })
    render(<AnalysisFailure analysis={failed} requestError={null} isRetrying={false} onRetry={onRetry} />)
    // Act
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry analysis' }))
    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent('The AI took too long to respond. Your entry is saved — try again.')
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('explains a request that never reached the server', () => {
    // Arrange
    const requestError = new TypeError('Failed to fetch')
    // Act
    render(<AnalysisFailure analysis={null} requestError={requestError} isRetrying={false} onRetry={vi.fn()} />)
    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't reach the server. Check your connection and try again. Your entry is saved.")
  })

  it('disables the retry while it runs', () => {
    // Arrange
    const isRetrying = true
    // Act
    render(<AnalysisFailure analysis={null} requestError={null} isRetrying={isRetrying} onRetry={vi.fn()} />)
    // Assert
    expect(screen.getByRole('button', { name: 'Retrying…' })).toBeDisabled()
  })
})
```

Run: `pnpm -C frontend test src/features/feedback`
Expected: FAIL — `./FeedbackView`, `./AnalysisFailure` unresolved.

- [ ] **Step 6: Implement the feedback components**

`frontend/src/features/feedback/Correction.tsx`:
```tsx
export interface CorrectionProps {
  original: string
  correction: string
}

// The arrow is decorative; screen readers hear "… should be …" instead.
export function Correction({ original, correction }: CorrectionProps) {
  return (
    <>
      <span className="line-through decoration-2">{original}</span>
      <span aria-hidden="true"> → </span>
      <span className="sr-only"> should be </span>
      <span>{correction}</span>
    </>
  )
}
```

`frontend/src/features/feedback/AnnotatedText.tsx`:
```tsx
import { Button } from '@/components/ui/Button'
import type { MistakeOut } from '@/types/analysis'
import { cn } from '@/utils/utils'
import { KIND_LABELS } from './labels'
import { markClasses } from './markClasses'
import { segmentText, type PlacedMistake } from './segmentText'

export interface AnnotatedTextProps {
  text: string
  placed: readonly PlacedMistake[]
  selectedId: string | null
  panelId: string
  onSelect: (mistake: MistakeOut, trigger: HTMLButtonElement) => void
}

export function AnnotatedText({ text, placed, selectedId, panelId, onSelect }: AnnotatedTextProps) {
  return (
    <p className="text-lg leading-loose whitespace-pre-wrap">
      {segmentText(text, placed).map(({ text: part, mistake }, index) => {
        if (!mistake) return <span key={`text-${index}`}>{part}</span>
        const selected = mistake.id === selectedId
        return (
          <Button
            key={mistake.id}
            variant="inline"
            className={cn(markClasses[mistake.kind], selected && 'outline-2 outline-primary')}
            aria-expanded={selected}
            aria-controls={selected ? panelId : undefined}
            onClick={(event) => onSelect(mistake, event.currentTarget)}
          >
            {part}
            <span className="sr-only"> ({KIND_LABELS[mistake.kind].toLowerCase()})</span>
          </Button>
        )
      })}
    </p>
  )
}
```

`frontend/src/features/feedback/MistakePanel.tsx`:
```tsx
import { useEffect, useId, useRef } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useEscapeKey } from '@/hooks/misc/useEscapeKey'
import type { MistakeOut } from '@/types/analysis'
import { Correction } from './Correction'
import { categoryLabel, KIND_LABELS } from './labels'

export interface MistakePanelProps {
  id: string
  mistake: MistakeOut
  onClose: () => void
}

export function MistakePanel({ id, mistake, onClose }: MistakePanelProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const titleId = useId()
  useEscapeKey(onClose)
  // Focus follows the learner into the panel so the explanation is read next.
  useEffect(() => headingRef.current?.focus(), [mistake.id])

  return (
    <section id={id} aria-labelledby={titleId} className="flex flex-col items-start gap-3 rounded-md border border-border bg-surface p-4">
      <h3 id={titleId} ref={headingRef} tabIndex={-1} className="text-lg font-semibold">
        <Correction original={mistake.original} correction={mistake.correction} />
      </h3>
      <div className="flex flex-wrap gap-2">
        <Badge>{categoryLabel(mistake.category)}</Badge>
        <Badge>{KIND_LABELS[mistake.kind]}</Badge>
      </div>
      <p className="text-sm">{mistake.explanation}</p>
      <Button onClick={onClose}>Close</Button>
    </section>
  )
}
```

`frontend/src/features/feedback/Legend.tsx`:
```tsx
import type { MistakeKind, MistakeOut } from '@/types/analysis'
import { KIND_LABELS } from './labels'
import { markClasses } from './markClasses'

const KINDS: MistakeKind[] = ['error', 'suggestion', 'vocab_help']

export interface LegendProps {
  mistakes: readonly MistakeOut[]
}

export function Legend({ mistakes }: LegendProps) {
  return (
    <ul aria-label="Feedback legend" className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
      {KINDS.map((kind) => (
        <li key={kind} className="flex items-center gap-1">
          <span className={markClasses[kind]}>{KIND_LABELS[kind]}</span>{' '}
          <span className="font-semibold">{mistakes.filter((mistake) => mistake.kind === kind).length}</span>
        </li>
      ))}
    </ul>
  )
}
```

`frontend/src/features/feedback/OtherNotes.tsx`:
```tsx
import { useId } from 'react'
import type { MistakeOut } from '@/types/analysis'
import { Correction } from './Correction'
import { categoryLabel, KIND_LABELS } from './labels'

export interface OtherNotesProps {
  mistakes: readonly MistakeOut[]
}

export function OtherNotes({ mistakes }: OtherNotesProps) {
  const headingId = useId()
  if (mistakes.length === 0) return null
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3 id={headingId} className="text-base font-semibold">
        Other notes
      </h3>
      <ul className="flex flex-col gap-2">
        {mistakes.map((mistake) => (
          <li key={mistake.id} className="flex flex-col gap-1 rounded-md border border-border p-3 text-sm">
            <p>
              <Correction original={mistake.original} correction={mistake.correction} />
            </p>
            <p className="text-muted">
              {KIND_LABELS[mistake.kind]} · {categoryLabel(mistake.category)} · {mistake.explanation}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
```

`frontend/src/features/feedback/FeedbackView.tsx`:
```tsx
import { useCallback, useId, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import type { AnalysisOut, MistakeOut } from '@/types/analysis'
import { AnnotatedText } from './AnnotatedText'
import { Legend } from './Legend'
import { MistakePanel } from './MistakePanel'
import { OtherNotes } from './OtherNotes'
import { placeMistakes } from './segmentText'

export interface FeedbackViewProps {
  analysis: AnalysisOut
  actions?: ReactNode
}

// Callers key this by analysis id, so switching analyses resets the open panel and the toggle.
export function FeedbackView({ analysis, actions }: FeedbackViewProps) {
  const [selected, setSelected] = useState<MistakeOut | null>(null)
  const [showCorrected, setShowCorrected] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const headingId = useId()
  const panelId = useId()
  const { placed, unplaced } = placeMistakes(analysis.input_text, analysis.mistakes)

  const open = (mistake: MistakeOut, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger
    setSelected(mistake)
  }
  const close = useCallback(() => {
    setSelected(null)
    triggerRef.current?.focus()
  }, [])
  const toggleCorrected = () => {
    setSelected(null)
    setShowCorrected((shown) => !shown)
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h2 id={headingId} className="text-xl font-semibold">
        Feedback
      </h2>
      <p>{analysis.feedback_summary}</p>
      {analysis.mistakes.length === 0 && <p className="text-muted">Nothing to correct in this entry.</p>}
      <Legend mistakes={analysis.mistakes} />
      <div>
        <Button aria-pressed={showCorrected} onClick={toggleCorrected}>
          Show corrected version
        </Button>
      </div>
      {showCorrected ? (
        <p className="text-lg leading-loose whitespace-pre-wrap">{analysis.corrected_text ?? analysis.input_text}</p>
      ) : (
        <AnnotatedText text={analysis.input_text} placed={placed} selectedId={selected?.id ?? null} panelId={panelId} onSelect={open} />
      )}
      {selected && <MistakePanel id={panelId} mistake={selected} onClose={close} />}
      <OtherNotes mistakes={unplaced} />
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </section>
  )
}
```

`frontend/src/features/feedback/AnalysisFailure.tsx`:
```tsx
import { ErrorState } from '@/components/ui/ErrorState'
import type { AnalysisOut } from '@/types/analysis'
import { toErrorMessage } from '@/utils/errorMessage'
import { failureMessage } from './labels'

export interface AnalysisFailureProps {
  analysis: AnalysisOut | null
  requestError: unknown
  isRetrying: boolean
  onRetry: () => void
}

export function AnalysisFailure({ analysis, requestError, isRetrying, onRetry }: AnalysisFailureProps) {
  const message = requestError
    ? `${toErrorMessage(requestError)} Your entry is saved.`
    : failureMessage(analysis?.error_code ?? null)
  return (
    <ErrorState message={message} onRetry={onRetry} retryLabel={isRetrying ? 'Retrying…' : 'Retry analysis'} retrying={isRetrying} />
  )
}
```

Run: `pnpm -C frontend test src/features/feedback`
Expected: PASS. If the keyboard test lands elsewhere, the tab order is: "Show corrected version" → first highlight; keep the toggle before the text.

- [ ] **Step 7: Gates**

Run: `make verify`
Expected: `ALL GATES GREEN`. (FeedbackView is not on a page yet; it is reachable for fallow through its tests.)

- [ ] **Step 8: Commit**

```bash
git add frontend/src/styles/tokens.css frontend/DESIGN.md frontend/src/components/ui/Button frontend/src/components/ui/Badge \
  frontend/src/components/ui/ErrorState frontend/src/hooks/misc frontend/src/features/feedback
git commit -m "feat(frontend): FeedbackView with code-point highlights, detail panel, corrected toggle and other notes"
```

---

### Task 5: Write — drafting, saving, analysing, retrying and revising

**Files:**
- Create: `frontend/src/components/ui/Select/{Select.tsx,Select.test.tsx,index.ts}`, `frontend/src/components/ui/Textarea/{Textarea.tsx,Textarea.test.tsx,index.ts}`, `frontend/src/components/ui/Field/{Field.tsx,Field.test.tsx,index.ts}`
- Create: `frontend/src/hooks/misc/useLocalStorage.ts`, `useLocalStorage.test.ts`, `useFocusOnMount.ts`
- Modify: `frontend/src/utils/constants.ts` (+ `STORAGE_KEYS`), `frontend/src/test/helpers.ts` (+ `waitForLanguages`, `slowDown`, `failWith`), `frontend/DESIGN.md`
- Create: `frontend/src/features/languages/LanguageSelect.tsx`, `LanguageSelect.test.tsx`
- Create: `frontend/src/features/editor/EntryTextField.tsx`, `useReviseEntry.ts`, `ReviseEditor.tsx`, `RevisableFeedback.tsx`, `ReviseEditor.test.tsx`
- Create: `frontend/src/features/write/useDraft.ts`, `useWriteSession.ts`, `EntryForm.tsx`, `WriteStatus.tsx`, `WriteEditor.tsx`, `WriteScreen.tsx`
- Modify: `frontend/src/pages/WritePage.tsx`
- Test: `frontend/src/features/write/WriteScreen.test.tsx`, `frontend/src/features/write/WriteScreen.flow.test.tsx`, `frontend/e2e/write.spec.ts`

**Interfaces:**
- Consumes: query/mutation hooks (Task 2); `FeedbackView`, `AnalysisFailure`, `Button`, `ErrorState` (Task 4); `toErrorMessage`, `countWords`, `pluralize`, `MAX_ENTRY_CHARS` (Task 1).
- Produces:
  - `STORAGE_KEYS = { draft: 'journal.draft', language: 'journal.language' }`.
  - `useLocalStorage(key: string): [string, (value: string) => void]` — empty string removes the key; storage errors are swallowed.
  - `useFocusOnMount<T extends HTMLElement>(): (node: T | null) => void` — stable callback ref.
  - `Select`, `Textarea` (native props), `Field({ label, htmlFor, children })`.
  - `LanguageSelect({ id, label, value, onChange(code), allLabel?, disabled? })` — loading option, error with retry, optional "all" option (value `''`).
  - `EntryTextField({ id, label, value, onChange, onSubmitShortcut, readOnly?, textareaRef? })` — word count + bracket hint as the textarea's description; ⌘/Ctrl+Enter calls `onSubmitShortcut`.
  - `ReviseEditor({ entryId, initialText, onDone, onCancel })`; `RevisableFeedback({ entry: EntryOut, analysis: AnalysisOut, extraActions?, onRevised? })` — FeedbackView with "Revise & re-check" that swaps in the editor.
  - `WriteScreen()` and the `WritePhase = 'editing' | 'saving' | 'analyzing' | 'done'` it derives.
  - Test helpers: `waitForLanguages()`, `slowDown(method, path, ms?)`, `failWith(method, path, status?)`.

- [ ] **Step 1: Write the failing primitive and storage tests**

`frontend/src/components/ui/Select/Select.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Select } from '.'

describe('Select', () => {
  it('renders a native select with its options and a touch-sized box', () => {
    // Arrange
    const options = ['es', 'fr']
    // Act
    render(
      <Select aria-label="Language" defaultValue="fr">
        {options.map((code) => (
          <option key={code} value={code}>
            {code}
          </option>
        ))}
      </Select>,
    )
    // Assert
    expect(screen.getByRole('combobox', { name: 'Language' })).toHaveValue('fr')
    expect(screen.getByRole('combobox')).toHaveClass('min-h-11')
  })
})
```

`frontend/src/components/ui/Textarea/Textarea.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Textarea } from '.'

describe('Textarea', () => {
  it('passes native props through', () => {
    // Arrange
    const maxLength = 10
    // Act
    render(<Textarea aria-label="Entry" maxLength={maxLength} readOnly />)
    // Assert
    expect(screen.getByRole('textbox', { name: 'Entry' })).toHaveAttribute('maxlength', '10')
    expect(screen.getByRole('textbox')).toHaveAttribute('readonly')
  })
})
```

`frontend/src/components/ui/Field/Field.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Field } from '.'

describe('Field', () => {
  it('labels the control it wraps', () => {
    // Arrange
    const label = 'Your entry'
    // Act
    render(
      <Field label={label} htmlFor="entry">
        <input id="entry" />
      </Field>,
    )
    // Assert
    expect(screen.getByRole('textbox', { name: 'Your entry' })).toBeInTheDocument()
  })
})
```

`frontend/src/hooks/misc/useLocalStorage.test.ts`:
```ts
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useLocalStorage } from './useLocalStorage'

describe('useLocalStorage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('starts from the stored value', () => {
    // Arrange
    localStorage.setItem('k', 'hola')
    // Act
    const { result } = renderHook(() => useLocalStorage('k'))
    // Assert
    expect(result.current[0]).toBe('hola')
  })

  it('stores every update', () => {
    // Arrange
    const { result } = renderHook(() => useLocalStorage('k'))
    // Act
    act(() => result.current[1]('adiós'))
    // Assert
    expect(result.current[0]).toBe('adiós')
    expect(localStorage.getItem('k')).toBe('adiós')
  })

  it('removes the key when the value is emptied', () => {
    // Arrange
    localStorage.setItem('k', 'hola')
    const { result } = renderHook(() => useLocalStorage('k'))
    // Act
    act(() => result.current[1](''))
    // Assert
    expect(localStorage.getItem('k')).toBeNull()
  })

  it('keeps working in memory when storage refuses to write', () => {
    // Arrange
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const { result } = renderHook(() => useLocalStorage('k'))
    // Act
    act(() => result.current[1]('hola'))
    // Assert
    expect(result.current[0]).toBe('hola')
  })
})
```

Run: `pnpm -C frontend test src/components/ui src/hooks/misc`
Expected: FAIL — unresolved `.` / `./useLocalStorage`.

- [ ] **Step 2: Implement the primitives and misc hooks**

`frontend/src/components/ui/Select/Select.tsx`:
```tsx
import type { ComponentProps } from 'react'
import { cn } from '@/utils/utils'

export type SelectProps = ComponentProps<'select'>

export function Select({ className, ...rest }: SelectProps) {
  return (
    <select
      className={cn('min-h-11 cursor-pointer rounded-md border border-border bg-bg px-3 text-sm text-fg disabled:cursor-not-allowed', className)}
      {...rest}
    />
  )
}
```
`frontend/src/components/ui/Select/index.ts`:
```ts
export { Select, type SelectProps } from './Select'
```

`frontend/src/components/ui/Textarea/Textarea.tsx`:
```tsx
import type { ComponentProps } from 'react'
import { cn } from '@/utils/utils'

export type TextareaProps = ComponentProps<'textarea'>

export function Textarea({ className, ...rest }: TextareaProps) {
  return (
    <textarea
      className={cn('min-h-48 w-full rounded-md border border-border bg-bg p-3 text-base leading-relaxed text-fg read-only:bg-surface', className)}
      {...rest}
    />
  )
}
```
`frontend/src/components/ui/Textarea/index.ts`:
```ts
export { Textarea, type TextareaProps } from './Textarea'
```

`frontend/src/components/ui/Field/Field.tsx`:
```tsx
import type { ReactNode } from 'react'

export interface FieldProps {
  label: string
  htmlFor: string
  children: ReactNode
}

export function Field({ label, htmlFor, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  )
}
```
`frontend/src/components/ui/Field/index.ts`:
```ts
export { Field, type FieldProps } from './Field'
```

`frontend/src/hooks/misc/useLocalStorage.ts`:
```ts
import { useCallback, useState } from 'react'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    if (value === '') localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Private mode or a full quota: the in-memory value still works for this visit.
  }
}

export function useLocalStorage(key: string): [string, (value: string) => void] {
  const [value, setValue] = useState(() => read(key) ?? '')
  const update = useCallback(
    (next: string) => {
      setValue(next)
      write(key, next)
    },
    [key],
  )
  return [value, update]
}
```

`frontend/src/hooks/misc/useFocusOnMount.ts`:
```ts
import { useCallback } from 'react'

// A stable callback ref runs once when the element mounts, so focus moves without an effect or a re-focus per render.
export function useFocusOnMount<T extends HTMLElement>(): (node: T | null) => void {
  return useCallback((node: T | null) => node?.focus(), [])
}
```

Add to `frontend/src/utils/constants.ts`:
```ts
export const STORAGE_KEYS = { draft: 'journal.draft', language: 'journal.language' } as const
```

Add to the Primitives table in `frontend/DESIGN.md`:
```
| `Select` | — | native `<select>`, `min-h-11`, pointer cursor |
| `Textarea` | — | native `<textarea>`, `min-h-48`, `read-only:` surface tint |
| `Field` | — | label + control; owns the spacing between them |
```

Run: `pnpm -C frontend test src/components/ui src/hooks/misc`
Expected: PASS.

- [ ] **Step 3: Extend the test helpers**

Replace `frontend/src/test/helpers.ts` with:
```ts
import { screen } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { API_BASE } from '@/utils/constants'
import { server } from './server'

type Method = 'get' | 'post' | 'patch'

export const apiUrl = (path: string) => `${API_BASE}${path}`

// The in-memory API reads `?mock=` from the window location; MemoryRouter never touches it.
export function setMockMode(mode: string): void {
  window.history.replaceState(null, '', `/?mock=${mode}`)
}

export function clearMockMode(): void {
  window.history.replaceState(null, '', '/')
}

export async function waitForLanguages(): Promise<void> {
  await screen.findByRole('option', { name: 'Spanish' })
}

// Returning nothing falls through to the in-memory handler, so this only adds latency to assert pending states.
export function slowDown(method: Method, path: string, ms = 100): void {
  server.use(
    http[method](apiUrl(path), async () => {
      await delay(ms)
    }),
  )
}

export function failWith(method: Method, path: string, status = 500): void {
  server.use(
    http[method](apiUrl(path), () =>
      HttpResponse.json(
        { type: 'about:blank', title: 'Error', status, detail: 'Failed', request_id: 'test-request' },
        { status, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    ),
  )
}
```

- [ ] **Step 4: Write the failing LanguageSelect and ReviseEditor tests**

`frontend/src/features/languages/LanguageSelect.test.tsx`:
```tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { clearMockMode, setMockMode, waitForLanguages } from '@/test/helpers'
import { renderWithProviders } from '@/test/renderWithProviders'
import { LanguageSelect } from './LanguageSelect'

describe('LanguageSelect', () => {
  it('shows a disabled loading option until the languages arrive', async () => {
    // Arrange
    renderWithProviders(<LanguageSelect id="l" label="Language" value="" onChange={vi.fn()} />)
    // Act
    const select = screen.getByLabelText('Language')
    // Assert
    expect(select).toBeDisabled()
    expect(screen.getByRole('option', { name: 'Loading languages…' })).toBeInTheDocument()
    await waitForLanguages()
    expect(select).toBeEnabled()
  })

  it('reports the chosen language code', async () => {
    // Arrange
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<LanguageSelect id="l" label="Language" value="es" onChange={onChange} />)
    await waitForLanguages()
    // Act
    await user.selectOptions(screen.getByLabelText('Language'), 'it')
    // Assert
    expect(onChange).toHaveBeenCalledWith('it')
  })

  it('can offer an option for every language', async () => {
    // Arrange
    renderWithProviders(<LanguageSelect id="l" label="Language" value="" onChange={vi.fn()} allLabel="All languages" />)
    // Act
    await waitForLanguages()
    // Assert
    expect(screen.getByRole('option', { name: 'All languages' })).toHaveValue('')
  })

  it('offers a retry when the languages cannot load', async () => {
    // Arrange
    setMockMode('error')
    const user = userEvent.setup()
    renderWithProviders(<LanguageSelect id="l" label="Language" value="" onChange={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/on our side/)
    clearMockMode()
    // Act
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    // Assert
    await waitForLanguages()
  })
})
```

`frontend/src/features/editor/ReviseEditor.test.tsx`:
```tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SEEDED } from '@/mocks/seed'
import { failWith } from '@/test/helpers'
import { renderWithProviders } from '@/test/renderWithProviders'
import { ENDPOINTS } from '@/utils/endpoints'
import { ReviseEditor } from './ReviseEditor'

const renderEditor = (onDone = vi.fn(), onCancel = vi.fn()) => {
  renderWithProviders(<ReviseEditor entryId={SEEDED.unanalysed} initialText="Hola" onDone={onDone} onCancel={onCancel} />)
  return userEvent.setup()
}

describe('ReviseEditor', () => {
  it('starts from the entry text with focus in the editor', () => {
    // Arrange + Act
    renderEditor()
    // Assert
    expect(screen.getByLabelText('Revise your entry')).toHaveValue('Hola')
    expect(screen.getByLabelText('Revise your entry')).toHaveFocus()
  })

  it('saves, re-checks and then reports it is done', async () => {
    // Arrange
    const onDone = vi.fn()
    const user = renderEditor(onDone)
    // Act
    await user.type(screen.getByLabelText('Revise your entry'), ' mundo')
    await user.click(screen.getByRole('button', { name: 'Re-check' }))
    // Assert
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
  })

  it('keeps the text and explains why when saving fails', async () => {
    // Arrange
    failWith('patch', ENDPOINTS.entry(':entryId'))
    const user = renderEditor()
    // Act
    await user.click(screen.getByRole('button', { name: 'Re-check' }))
    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(/on our side/)
    expect(screen.getByLabelText('Revise your entry')).toHaveValue('Hola')
  })

  it('will not re-check blank text', async () => {
    // Arrange
    const user = renderEditor()
    // Act
    await user.clear(screen.getByLabelText('Revise your entry'))
    // Assert
    expect(screen.getByRole('button', { name: 'Re-check' })).toBeDisabled()
  })

  it('cancels without saving', async () => {
    // Arrange
    const onCancel = vi.fn()
    const user = renderEditor(vi.fn(), onCancel)
    // Act
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    // Assert
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
```

Run: `pnpm -C frontend test src/features/languages src/features/editor`
Expected: FAIL — unresolved `./LanguageSelect`, `./ReviseEditor`.

- [ ] **Step 5: Implement LanguageSelect and the editor pieces**

`frontend/src/features/languages/LanguageSelect.tsx`:
```tsx
import { ErrorState } from '@/components/ui/ErrorState'
import { Field } from '@/components/ui/Field'
import { Select } from '@/components/ui/Select'
import { useLanguagesQuery } from '@/hooks/queries/useLanguagesQuery'
import { toErrorMessage } from '@/utils/errorMessage'

export interface LanguageSelectProps {
  id: string
  label: string
  value: string
  onChange: (code: string) => void
  allLabel?: string
  disabled?: boolean
}

export function LanguageSelect({ id, label, value, onChange, allLabel, disabled = false }: LanguageSelectProps) {
  const languages = useLanguagesQuery()
  if (languages.isError) {
    return <ErrorState message={toErrorMessage(languages.error)} onRetry={() => void languages.refetch()} />
  }
  return (
    <Field label={label} htmlFor={id}>
      <Select id={id} value={value} disabled={disabled || languages.isPending} onChange={(event) => onChange(event.target.value)}>
        {languages.isPending ? (
          <option value={value}>Loading languages…</option>
        ) : (
          <>
            {allLabel !== undefined && <option value="">{allLabel}</option>}
            {languages.data.map((language) => (
              <option key={language.code} value={language.code}>
                {language.name}
              </option>
            ))}
          </>
        )}
      </Select>
    </Field>
  )
}
```
(The disabled loading select has the same height as the loaded one, so Lighthouse sees no layout shift.)

`frontend/src/features/editor/EntryTextField.tsx`:
```tsx
import type { KeyboardEvent, Ref } from 'react'
import { Field } from '@/components/ui/Field'
import { Textarea } from '@/components/ui/Textarea'
import { MAX_ENTRY_CHARS } from '@/utils/constants'
import { pluralize } from '@/utils/formatter'
import { countWords } from '@/utils/text'

export interface EntryTextFieldProps {
  id: string
  label: string
  value: string
  onChange: (text: string) => void
  onSubmitShortcut: () => void
  readOnly?: boolean
  textareaRef?: Ref<HTMLTextAreaElement>
}

export function EntryTextField({ id, label, value, onChange, onSubmitShortcut, readOnly = false, textareaRef }: EntryTextFieldProps) {
  const hintId = `${id}-hint`
  const countId = `${id}-count`
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return
    event.preventDefault()
    onSubmitShortcut()
  }
  return (
    <Field label={label} htmlFor={id}>
      <Textarea
        id={id}
        ref={textareaRef}
        value={value}
        readOnly={readOnly}
        maxLength={MAX_ENTRY_CHARS}
        aria-describedby={`${hintId} ${countId}`}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className="flex flex-wrap justify-between gap-2 text-sm text-muted">
        <p id={hintId}>Stuck on a word? Write it in English in [brackets] and the feedback will suggest it.</p>
        <p id={countId}>{pluralize(countWords(value), 'word')}</p>
      </div>
    </Field>
  )
}
```
(`maxLength` counts UTF-16 units, which is never more permissive than the backend's 5000 code points.)

`frontend/src/features/editor/useReviseEntry.ts`:
```ts
import { useUpdateEntryMutation } from '@/hooks/mutations/useUpdateEntryMutation'
import { useRunAnalysisMutation } from '@/hooks/mutations/useRunAnalysisMutation'

// Save the text first, then analyse it: a failed analysis never loses the revision.
export function useReviseEntry(entryId: string) {
  const update = useUpdateEntryMutation()
  const analyze = useRunAnalysisMutation()
  const submit = (text: string, onDone: () => void) =>
    update.mutate({ id: entryId, text }, { onSuccess: () => analyze.mutate(entryId, { onSuccess: onDone }) })
  return { submit, isPending: update.isPending || analyze.isPending, error: update.error ?? analyze.error }
}
```

`frontend/src/features/editor/ReviseEditor.tsx`:
```tsx
import { useId, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useFocusOnMount } from '@/hooks/misc/useFocusOnMount'
import { toErrorMessage } from '@/utils/errorMessage'
import { EntryTextField } from './EntryTextField'
import { useReviseEntry } from './useReviseEntry'

export interface ReviseEditorProps {
  entryId: string
  initialText: string
  onDone: () => void
  onCancel: () => void
}

export function ReviseEditor({ entryId, initialText, onDone, onCancel }: ReviseEditorProps) {
  const [text, setText] = useState(initialText)
  const revise = useReviseEntry(entryId)
  const fieldId = useId()
  const focusRef = useFocusOnMount<HTMLTextAreaElement>()
  const canSubmit = text.trim() !== '' && !revise.isPending
  const submit = () => {
    if (canSubmit) revise.submit(text, onDone)
  }

  return (
    <form
      aria-label="Revise entry"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <EntryTextField id={fieldId} label="Revise your entry" value={text} onChange={setText} onSubmitShortcut={submit} readOnly={revise.isPending} textareaRef={focusRef} />
      {revise.error ? (
        <p role="alert" className="text-sm text-danger">
          {toErrorMessage(revise.error)}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" disabled={!canSubmit}>
          {revise.isPending ? 'Re-checking…' : 'Re-check'}
        </Button>
        <Button onClick={onCancel} disabled={revise.isPending}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
```

`frontend/src/features/editor/RevisableFeedback.tsx`:
```tsx
import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { FeedbackView } from '@/features/feedback/FeedbackView'
import type { AnalysisOut } from '@/types/analysis'
import type { EntryOut } from '@/types/entry'
import { ReviseEditor } from './ReviseEditor'

export interface RevisableFeedbackProps {
  entry: EntryOut
  analysis: AnalysisOut
  extraActions?: ReactNode
  onRevised?: () => void
}

export function RevisableFeedback({ entry, analysis, extraActions, onRevised }: RevisableFeedbackProps) {
  const [revising, setRevising] = useState(false)
  if (revising) {
    const finish = () => {
      setRevising(false)
      onRevised?.()
    }
    return <ReviseEditor entryId={entry.id} initialText={entry.text} onDone={finish} onCancel={() => setRevising(false)} />
  }
  const actions = (
    <>
      <Button variant="primary" onClick={() => setRevising(true)}>
        Revise &amp; re-check
      </Button>
      {extraActions}
    </>
  )
  return <FeedbackView key={analysis.id} analysis={analysis} actions={actions} />
}
```

Run: `pnpm -C frontend test src/features/languages src/features/editor`
Expected: PASS.

- [ ] **Step 6: Write the failing WriteScreen tests**

`frontend/src/features/write/WriteScreen.test.tsx`:
```tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { waitForLanguages } from '@/test/helpers'
import { renderWithProviders } from '@/test/renderWithProviders'
import { STORAGE_KEYS } from '@/utils/constants'
import { WriteScreen } from './WriteScreen'

describe('WriteScreen while drafting', () => {
  it('preselects the last language used', async () => {
    // Arrange
    localStorage.setItem(STORAGE_KEYS.language, 'fr')
    // Act
    renderWithProviders(<WriteScreen />)
    await waitForLanguages()
    // Assert
    expect(screen.getByLabelText('Language')).toHaveValue('fr')
  })

  it('falls back to the first language when the remembered one is no longer offered', async () => {
    // Arrange
    localStorage.setItem(STORAGE_KEYS.language, 'xx')
    // Act
    renderWithProviders(<WriteScreen />)
    await waitForLanguages()
    // Assert
    expect(screen.getByLabelText('Language')).toHaveValue('es')
  })

  it('remembers a newly chosen language', async () => {
    // Arrange
    const user = userEvent.setup()
    renderWithProviders(<WriteScreen />)
    await waitForLanguages()
    // Act
    await user.selectOptions(screen.getByLabelText('Language'), 'de')
    // Assert
    expect(localStorage.getItem(STORAGE_KEYS.language)).toBe('de')
  })

  it('restores the draft kept on this device', () => {
    // Arrange
    localStorage.setItem(STORAGE_KEYS.draft, 'Hola otra vez')
    // Act
    renderWithProviders(<WriteScreen />)
    // Assert
    expect(screen.getByLabelText('Your entry')).toHaveValue('Hola otra vez')
    expect(screen.getByRole('status')).toHaveTextContent('Draft kept on this device')
  })

  it('autosaves the draft and counts words as you type', async () => {
    // Arrange
    const user = userEvent.setup()
    renderWithProviders(<WriteScreen />)
    // Act
    await user.type(screen.getByLabelText('Your entry'), 'Hoy es lunes')
    // Assert
    expect(localStorage.getItem(STORAGE_KEYS.draft)).toBe('Hoy es lunes')
    expect(screen.getByText('3 words')).toBeInTheDocument()
  })

  it('explains the bracket fallback for words you do not know yet', () => {
    // Arrange + Act
    renderWithProviders(<WriteScreen />)
    // Assert
    expect(screen.getByLabelText('Your entry')).toHaveAccessibleDescription(/in English in \[brackets\]/)
  })

  it('keeps "Get feedback" disabled until there is text', async () => {
    // Arrange
    renderWithProviders(<WriteScreen />)
    // Act
    await waitForLanguages()
    // Assert
    expect(screen.getByRole('button', { name: 'Get feedback' })).toBeDisabled()
  })
})
```

`frontend/src/features/write/WriteScreen.flow.test.tsx`:
```tsx
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { listEntries } from '@/mocks/db'
import { failWith, setMockMode, slowDown, waitForLanguages } from '@/test/helpers'
import { renderWithProviders } from '@/test/renderWithProviders'
import { STORAGE_KEYS } from '@/utils/constants'
import { ENDPOINTS } from '@/utils/endpoints'
import { WriteScreen } from './WriteScreen'

const ENTRY = 'Ayer yo es feliz en el [park].'

// A stored draft avoids typing `[`, which user-event treats as a key descriptor.
async function startWithDraft(text = ENTRY) {
  localStorage.setItem(STORAGE_KEYS.draft, text)
  const user = userEvent.setup()
  renderWithProviders(<WriteScreen />)
  await waitForLanguages()
  return user
}

const getFeedback = () => screen.getByRole('button', { name: 'Get feedback' })

describe('WriteScreen submitting', () => {
  it('saves, analyses and shows feedback, then clears the local draft', async () => {
    // Arrange
    slowDown('post', ENDPOINTS.analyses(':entryId'))
    const user = await startWithDraft()
    // Act
    await user.click(getFeedback())
    // Assert
    expect(await screen.findByText('Saved. Analyzing…')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Feedback' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/^Saved$/)
    expect(localStorage.getItem(STORAGE_KEYS.draft)).toBeNull()
  })

  it('submits with Ctrl+Enter from the text box', async () => {
    // Arrange
    const user = await startWithDraft()
    await user.click(screen.getByLabelText('Your entry'))
    // Act
    await user.keyboard('{Control>}{Enter}{/Control}')
    // Assert
    expect(await screen.findByRole('heading', { name: 'Feedback' })).toBeInTheDocument()
  })

  it('creates exactly one entry when the button is pressed twice', async () => {
    // Arrange
    const user = await startWithDraft()
    // Act
    await user.dblClick(getFeedback())
    await screen.findByRole('heading', { name: 'Feedback' })
    // Assert
    expect(listEntries(null, null, 50)?.items).toHaveLength(15)
  })

  it('keeps the entry and offers a retry when the analysis fails', async () => {
    // Arrange
    setMockMode('analysis-fail')
    const user = await startWithDraft()
    await user.click(getFeedback())
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The AI took too long to respond. Your entry is saved — try again.')
    // Act
    await user.click(within(alert).getByRole('button', { name: 'Retry analysis' }))
    // Assert
    expect(await screen.findByRole('heading', { name: 'Feedback' })).toBeInTheDocument()
  })

  it('shows the saved text while the failed analysis waits for a retry', async () => {
    // Arrange
    setMockMode('analysis-fail')
    const user = await startWithDraft()
    // Act
    await user.click(getFeedback())
    await screen.findByRole('alert')
    // Assert
    expect(screen.getByLabelText('Your entry')).toHaveValue(ENTRY)
    expect(screen.getByLabelText('Your entry')).toHaveAttribute('readonly')
  })

  it('keeps the draft and re-enables the button when saving fails', async () => {
    // Arrange
    failWith('post', ENDPOINTS.entries)
    const user = await startWithDraft()
    // Act
    await user.click(getFeedback())
    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent('Your draft is still here.')
    expect(localStorage.getItem(STORAGE_KEYS.draft)).toBe(ENTRY)
    expect(getFeedback()).toBeEnabled()
  })

  it('revises the entry and shows the new analysis', async () => {
    // Arrange
    const user = await startWithDraft()
    await user.click(getFeedback())
    await user.click(await screen.findByRole('button', { name: 'Revise & re-check' }))
    const editor = screen.getByLabelText('Revise your entry')
    // Act
    await user.clear(editor)
    await user.type(editor, 'Ayer fui feliz.')
    await user.click(screen.getByRole('button', { name: 'Re-check' }))
    // Assert
    expect(await screen.findByText('Great job — no mistakes found!')).toBeInTheDocument()
  })

  it('starts a fresh, focused entry from "New entry"', async () => {
    // Arrange
    const user = await startWithDraft()
    await user.click(getFeedback())
    // Act
    await user.click(await screen.findByRole('button', { name: 'New entry' }))
    // Assert
    expect(screen.getByLabelText('Your entry')).toHaveValue('')
    expect(screen.getByLabelText('Your entry')).toHaveFocus()
    expect(getFeedback()).toBeDisabled()
  })
})
```

Run: `pnpm -C frontend test src/features/write`
Expected: FAIL — unresolved `./WriteScreen`.

- [ ] **Step 7: Implement the Write feature**

`frontend/src/features/write/useDraft.ts`:
```ts
import { useLocalStorage } from '@/hooks/misc/useLocalStorage'
import { useLanguagesQuery } from '@/hooks/queries/useLanguagesQuery'
import { STORAGE_KEYS } from '@/utils/constants'

export function useDraft() {
  const [text, setText] = useLocalStorage(STORAGE_KEYS.draft)
  const [storedLanguage, setLanguage] = useLocalStorage(STORAGE_KEYS.language)
  const languages = useLanguagesQuery().data ?? []
  // Derived, not stored: a remembered code that is no longer offered falls back to the first language.
  const language = languages.some((l) => l.code === storedLanguage) ? storedLanguage : (languages[0]?.code ?? '')
  return { text, setText, language, setLanguage, clearText: () => setText('') }
}

export type Draft = ReturnType<typeof useDraft>
```

`frontend/src/features/write/useWriteSession.ts`:
```ts
import { useRef, useState } from 'react'
import { useCreateEntryMutation } from '@/hooks/mutations/useCreateEntryMutation'
import { useRunAnalysisMutation } from '@/hooks/mutations/useRunAnalysisMutation'
import { useEntryQuery } from '@/hooks/queries/useEntryQuery'
import type { EntryCreate } from '@/types/entry'

export type WritePhase = 'editing' | 'saving' | 'analyzing' | 'done'

function phaseOf(saving: boolean, entryId: string | null, analyzing: boolean): WritePhase {
  if (saving) return 'saving'
  if (entryId === null) return 'editing'
  return analyzing ? 'analyzing' : 'done'
}

// Save first, analyse second (spec §2): the entry exists before the model is called.
export function useWriteSession(onSaved: () => void) {
  const [entryId, setEntryId] = useState<string | null>(null)
  // A ref, not state: the second click of a double click lands before React re-renders the disabled button.
  const submitting = useRef(false)
  const create = useCreateEntryMutation()
  const analyze = useRunAnalysisMutation()
  const entry = useEntryQuery(entryId).data ?? null
  const analysis = entry?.latest_analysis ?? null
  // Until the first result or error arrives the entry is still being analysed, even before isPending flips.
  const analyzing = analyze.isPending || (analysis === null && analyze.error === null)

  const submit = (body: EntryCreate) => {
    if (submitting.current || entryId) return
    submitting.current = true
    create.mutate(body, {
      onSuccess: (created) => {
        setEntryId(created.id)
        onSaved()
        analyze.mutate(created.id)
      },
      onSettled: () => {
        submitting.current = false
      },
    })
  }
  const retry = () => {
    if (entryId) analyze.mutate(entryId)
  }
  const reset = () => {
    setEntryId(null)
    create.reset()
    analyze.reset()
  }

  return {
    entry,
    analysis,
    phase: phaseOf(create.isPending, entryId, analyzing),
    saveError: create.error,
    analyzeError: analyze.error,
    submit,
    retry,
    reset,
  }
}

export type WriteSession = ReturnType<typeof useWriteSession>
```

`frontend/src/features/write/WriteStatus.tsx`:
```tsx
import type { WritePhase } from './useWriteSession'

const MESSAGES: Record<WritePhase, string> = {
  editing: '',
  saving: 'Saving…',
  analyzing: 'Saved. Analyzing…',
  done: 'Saved',
}

export interface WriteStatusProps {
  phase: WritePhase
  hasDraft: boolean
}

// Always rendered so screen readers hear each change; the fixed height avoids layout shift.
export function WriteStatus({ phase, hasDraft }: WriteStatusProps) {
  const message = phase === 'editing' && hasDraft ? 'Draft kept on this device' : MESSAGES[phase]
  return (
    <p role="status" className="min-h-5 text-sm text-muted">
      {message}
    </p>
  )
}
```

`frontend/src/features/write/EntryForm.tsx`:
```tsx
import { Button } from '@/components/ui/Button'
import { EntryTextField } from '@/features/editor/EntryTextField'
import { LanguageSelect } from '@/features/languages/LanguageSelect'
import { useFocusOnMount } from '@/hooks/misc/useFocusOnMount'
import type { WritePhase } from './useWriteSession'

const SUBMIT_LABELS: Record<WritePhase, string> = {
  editing: 'Get feedback',
  saving: 'Saving…',
  analyzing: 'Analyzing…',
  done: 'Get feedback',
}

export interface EntryFormProps {
  language: string
  onLanguageChange: (code: string) => void
  text: string
  onTextChange: (text: string) => void
  phase: WritePhase
  focusOnMount: boolean
  onSubmit: () => void
}

export function EntryForm({ language, onLanguageChange, text, onTextChange, phase, focusOnMount, onSubmit }: EntryFormProps) {
  const focusRef = useFocusOnMount<HTMLTextAreaElement>()
  const locked = phase !== 'editing'
  const canSubmit = !locked && language !== '' && text.trim() !== ''
  const submit = () => {
    if (canSubmit) onSubmit()
  }

  return (
    <form
      aria-label="New journal entry"
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <div className="max-w-xs">
        <LanguageSelect id="entry-language" label="Language" value={language} onChange={onLanguageChange} disabled={locked} />
      </div>
      <EntryTextField id="entry-text" label="Your entry" value={text} onChange={onTextChange} onSubmitShortcut={submit} readOnly={locked} textareaRef={focusOnMount ? focusRef : undefined} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={!canSubmit}>
          {SUBMIT_LABELS[phase]}
        </Button>
        <p className="text-sm text-muted">or press ⌘/Ctrl + Enter</p>
      </div>
    </form>
  )
}
```

`frontend/src/features/write/WriteEditor.tsx`:
```tsx
import type { ReactNode } from 'react'
import { AnalysisFailure } from '@/features/feedback/AnalysisFailure'
import { toErrorMessage } from '@/utils/errorMessage'
import { EntryForm } from './EntryForm'
import type { Draft } from './useDraft'
import type { WriteSession } from './useWriteSession'

export interface WriteEditorProps {
  draft: Draft
  session: WriteSession
  focusOnMount: boolean
  newEntryButton: ReactNode
}

// Before saving the form edits the draft; after saving it shows the stored entry read-only.
export function WriteEditor({ draft, session, focusOnMount, newEntryButton }: WriteEditorProps) {
  const { entry, phase } = session
  return (
    <>
      <EntryForm
        language={entry?.language ?? draft.language}
        onLanguageChange={draft.setLanguage}
        text={entry?.text ?? draft.text}
        onTextChange={draft.setText}
        phase={phase}
        focusOnMount={focusOnMount}
        onSubmit={() => session.submit({ language: draft.language, text: draft.text })}
      />
      {session.saveError ? (
        <p role="alert" className="text-sm text-danger">
          {toErrorMessage(session.saveError)} Your draft is still here.
        </p>
      ) : null}
      {phase === 'done' && (
        <div className="flex flex-col items-start gap-3">
          <AnalysisFailure analysis={session.analysis} requestError={session.analyzeError} isRetrying={false} onRetry={session.retry} />
          {newEntryButton}
        </div>
      )}
    </>
  )
}
```

`frontend/src/features/write/WriteScreen.tsx`:
```tsx
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { RevisableFeedback } from '@/features/editor/RevisableFeedback'
import { useDraft } from './useDraft'
import { useWriteSession } from './useWriteSession'
import { WriteEditor } from './WriteEditor'
import { WriteStatus } from './WriteStatus'

export function WriteScreen() {
  const draft = useDraft()
  const session = useWriteSession(draft.clearText)
  // False on first load so the page never steals focus; true after "New entry".
  const [focusEditor, setFocusEditor] = useState(false)
  const { entry, analysis, phase } = session
  const startOver = () => {
    session.reset()
    setFocusEditor(true)
  }
  const newEntryButton = <Button onClick={startOver}>New entry</Button>
  const succeeded = phase === 'done' && entry !== null && analysis?.status === 'succeeded'

  return (
    <div className="flex flex-col gap-4">
      <WriteStatus phase={phase} hasDraft={draft.text.trim() !== ''} />
      {succeeded && entry && analysis ? (
        <RevisableFeedback entry={entry} analysis={analysis} extraActions={newEntryButton} />
      ) : (
        <WriteEditor draft={draft} session={session} focusOnMount={focusEditor} newEntryButton={newEntryButton} />
      )}
    </div>
  )
}
```

Replace `frontend/src/pages/WritePage.tsx` with:
```tsx
import { WriteScreen } from '@/features/write/WriteScreen'

export function WritePage() {
  return (
    <div className="flex flex-col gap-6">
      <title>Write · Language Journal</title>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Write</h1>
        <p className="text-muted">Write freely in the language you are learning, then get feedback.</p>
      </div>
      <WriteScreen />
    </div>
  )
}
```

Run: `pnpm -C frontend test`
Expected: PASS (including `AppRoutes.test.tsx`, whose Write heading is still in the page).

- [ ] **Step 8: Write the e2e journeys**

`frontend/e2e/write.spec.ts`:
```ts
import { expect, test, type Page } from '@playwright/test'
import { expectNoA11yViolations } from './a11y'
import { expectButtonsShowPointer } from './cursor'

const ENTRY = 'Ayer yo es feliz en el [park].'

async function expectHealthy(page: Page): Promise<void> {
  await expectNoA11yViolations(page)
  await expectButtonsShowPointer(page)
}

async function writeEntry(page: Page, path = '/'): Promise<void> {
  await page.goto(path)
  await page.getByLabel('Language').selectOption('es')
  await page.getByLabel('Your entry').fill(ENTRY)
}

test('writing an entry shows inline feedback, a detail panel and the corrected version', async ({ page }) => {
  // Arrange
  await writeEntry(page)
  await expectHealthy(page)
  // Act
  await page.getByRole('button', { name: 'Get feedback' }).click()
  // Assert
  await expect(page.getByRole('heading', { name: 'Feedback' })).toBeVisible()
  await expect(page.getByRole('status')).toHaveText('Saved')
  await expectHealthy(page)
  const highlight = page.getByRole('button', { name: /yo es/ })
  await highlight.click()
  const panel = page.getByRole('region', { name: /should be yo soy/ })
  await expect(panel).toContainText('Verb conjugation')
  await expectHealthy(page)
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()
  await expect(highlight).toBeFocused()
  const toggle = page.getByRole('button', { name: 'Show corrected version' })
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Ayer yo soy feliz en el parque.')).toBeVisible()
  await expectHealthy(page)
})

test('a failed analysis keeps the entry and can be retried', async ({ page }) => {
  // Arrange
  await writeEntry(page, '/?mock=analysis-fail')
  // Act
  await page.getByRole('button', { name: 'Get feedback' }).click()
  // Assert
  const alert = page.getByRole('alert')
  await expect(alert).toContainText('took too long')
  await expect(page.getByLabel('Your entry')).toHaveValue(ENTRY)
  await expectHealthy(page)
  await alert.getByRole('button', { name: 'Retry analysis' }).click()
  await expect(page.getByRole('heading', { name: 'Feedback' })).toBeVisible()
  await expectHealthy(page)
})

test('revising an entry re-checks it and shows the new feedback', async ({ page }) => {
  // Arrange
  await writeEntry(page)
  await page.getByRole('button', { name: 'Get feedback' }).click()
  await page.getByRole('button', { name: 'Revise & re-check' }).click()
  const editor = page.getByLabel('Revise your entry')
  await expect(editor).toHaveValue(ENTRY)
  // Act
  await editor.fill('Ayer yo soy feliz en el parque.')
  await expectHealthy(page)
  await page.getByRole('button', { name: 'Re-check' }).click()
  // Assert
  await expect(page.getByText('Great job — no mistakes found!')).toBeVisible()
  await expectHealthy(page)
})

test('a draft survives a reload', async ({ page }) => {
  // Arrange
  await writeEntry(page)
  // Act
  await page.reload()
  // Assert
  await expect(page.getByLabel('Your entry')).toHaveValue(ENTRY)
  await expect(page.getByRole('status')).toHaveText('Draft kept on this device')
})
```

- [ ] **Step 9: Gates**

Run: `make verify`
Expected: `ALL GATES GREEN` — Lighthouse audits the real Write page now (mock build; the disabled loading select keeps CLS at 0).

- [ ] **Step 10: Commit**

```bash
git add frontend/src/components/ui/Select frontend/src/components/ui/Textarea frontend/src/components/ui/Field \
  frontend/src/hooks/misc frontend/src/utils/constants.ts frontend/src/test/helpers.ts frontend/DESIGN.md \
  frontend/src/features/languages frontend/src/features/editor frontend/src/features/write \
  frontend/src/pages/WritePage.tsx frontend/e2e/write.spec.ts
git commit -m "feat(frontend): Write screen with autosaved draft, save-then-analyse, retry and revise & re-check"
```

---

### Task 6: History and entry detail

**Files:**
- Create: `frontend/src/components/ui/LoadingState/{LoadingState.tsx,LoadingState.test.tsx,index.ts}`, `frontend/src/components/ui/EmptyState/{EmptyState.tsx,EmptyState.test.tsx,index.ts}`
- Modify: `frontend/src/utils/formatter.ts`, `frontend/src/utils/formatter.test.ts`, `frontend/DESIGN.md`
- Create: `frontend/src/features/languages/useLanguageName.ts`
- Create: `frontend/src/features/history/HistoryList.tsx`, `HistoryResults.tsx`, `LoadMore.tsx`, `EntryRow.tsx`, `RetryAnalysisButton.tsx`
- Create: `frontend/src/features/entry-detail/EntryDetail.tsx`, `EntryHeader.tsx`, `AnalysisSwitcher.tsx`, `DetailAnalysis.tsx`
- Modify: `frontend/src/pages/HistoryPage.tsx`, `frontend/src/pages/EntryDetailPage.tsx`
- Test: `frontend/src/features/history/HistoryList.test.tsx`, `frontend/src/features/history/EntryRow.test.tsx`, `frontend/src/features/entry-detail/EntryDetail.test.tsx`, `frontend/e2e/history.spec.ts`

**Interfaces:**
- Consumes: `useEntriesQuery`, `useEntryQuery`, `useAnalysesQuery`, `useLanguagesQuery`, `useRunAnalysisMutation` (Task 2); `Button`, `Badge`, `ErrorState`, `AnalysisFailure` (Task 4); `Select`, `Field`, `LanguageSelect`, `RevisableFeedback`, test helpers (Task 5); `TextLink` (Task 3); `SEEDED` (Task 1).
- Produces:
  - `LoadingState({ label })` (`role="status"`, `aria-busy`), `EmptyState({ title, children? })`.
  - `formatDateTime(iso: string): string` (`utils/formatter`, `en`, medium date + short time).
  - `useLanguageName(code: string): string` — name from the languages query, upper-cased code until it loads.
  - `HistoryList()` — filter in `?language=`; list named "Entries"; status "Showing N entries"; "Load more".
  - `EntryDetail({ entryId })` — header, "Analysis" switcher (only with ≥2 analyses, newest first, "(latest)" on the first), FeedbackView of the selected analysis with "Revise & re-check", retry for failed ones, "Get feedback" for never-analysed entries.

- [ ] **Step 1: Write the failing primitive and formatter tests**

`frontend/src/components/ui/LoadingState/LoadingState.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LoadingState } from '.'

describe('LoadingState', () => {
  it('announces what is loading as a busy status', () => {
    // Arrange
    const label = 'Loading entries…'
    // Act
    render(<LoadingState label={label} />)
    // Assert
    expect(screen.getByRole('status')).toHaveTextContent(label)
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  })
})
```

`frontend/src/components/ui/EmptyState/EmptyState.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmptyState } from '.'

describe('EmptyState', () => {
  it('shows the title and the next useful action', () => {
    // Arrange
    const action = <a href="/">Write your first entry</a>
    // Act
    render(<EmptyState title="No entries yet">{action}</EmptyState>)
    // Assert
    expect(screen.getByText('No entries yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Write your first entry' })).toBeInTheDocument()
  })
})
```

Append to `frontend/src/utils/formatter.test.ts` (merge the import to `import { formatDateTime, pluralize } from './formatter'`):
```ts
describe('formatDateTime', () => {
  it('shows a short, readable date and time', () => {
    // Arrange
    const iso = '2026-10-09T18:00:00Z'
    // Act
    const label = formatDateTime(iso)
    // Assert
    expect(label).toMatch(/^Oct \d{1,2}, 2026, \d{1,2}:\d{2}\s?[AP]M$/)
  })
})
```

Run: `pnpm -C frontend test src/components/ui src/utils/formatter.test.ts`
Expected: FAIL — unresolved imports / `formatDateTime` missing.

- [ ] **Step 2: Implement them**

`frontend/src/components/ui/LoadingState/LoadingState.tsx`:
```tsx
export interface LoadingStateProps {
  label: string
}

export function LoadingState({ label }: LoadingStateProps) {
  return (
    <div role="status" aria-busy="true" className="py-8 text-center text-sm text-muted">
      {label}
    </div>
  )
}
```
`frontend/src/components/ui/LoadingState/index.ts`:
```ts
export { LoadingState, type LoadingStateProps } from './LoadingState'
```

`frontend/src/components/ui/EmptyState/EmptyState.tsx`:
```tsx
import type { ReactNode } from 'react'

export interface EmptyStateProps {
  title: string
  children?: ReactNode
}

export function EmptyState({ title, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border p-8 text-center">
      <p className="font-medium">{title}</p>
      {children}
    </div>
  )
}
```
`frontend/src/components/ui/EmptyState/index.ts`:
```ts
export { EmptyState, type EmptyStateProps } from './EmptyState'
```

Add to `frontend/src/utils/formatter.ts`:
```ts
const dateTime = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' })

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso))
}
```

Add to the Primitives table in `frontend/DESIGN.md`:
```
| `LoadingState` | — | `role="status"` + `aria-busy`, muted label in place of content |
| `EmptyState` | — | dashed box: title + the next useful action as `children` |
```

`frontend/src/features/languages/useLanguageName.ts`:
```ts
import { useLanguagesQuery } from '@/hooks/queries/useLanguagesQuery'

export function useLanguageName(code: string): string {
  const { data } = useLanguagesQuery()
  return data?.find((language) => language.code === code)?.name ?? code.toUpperCase()
}
```

Run: `pnpm -C frontend test src/components/ui src/utils/formatter.test.ts`
Expected: PASS.

- [ ] **Step 3: Write the failing History tests**

`frontend/src/features/history/HistoryList.test.tsx`:
```tsx
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { apiUrl, failWith, setMockMode, waitForLanguages } from '@/test/helpers'
import { renderWithProviders } from '@/test/renderWithProviders'
import { server } from '@/test/server'
import { ENDPOINTS } from '@/utils/endpoints'
import { HistoryList } from './HistoryList'

const renderHistory = () => renderWithProviders(<HistoryList />, { route: '/entries' })
const rows = () => within(screen.getByRole('list', { name: 'Entries' })).getAllByRole('listitem')

describe('HistoryList', () => {
  it('shows a loading state, then the newest ten entries', async () => {
    // Arrange + Act
    renderHistory()
    // Assert
    expect(screen.getByRole('status')).toHaveTextContent('Loading entries…')
    expect(await screen.findByText('Showing 10 entries')).toBeInTheDocument()
    expect(rows()).toHaveLength(10)
  })

  it('loads the next page with "Load more" until none are left', async () => {
    // Arrange
    const user = userEvent.setup()
    renderHistory()
    await screen.findByText('Showing 10 entries')
    // Act
    await user.click(screen.getByRole('button', { name: 'Load more' }))
    // Assert
    expect(await screen.findByText('Showing 14 entries')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('filters by language', async () => {
    // Arrange
    const user = userEvent.setup()
    renderHistory()
    await waitForLanguages()
    // Act
    await user.selectOptions(screen.getByLabelText('Language'), 'fr')
    // Assert
    expect(await screen.findByText('Showing 4 entries')).toBeInTheDocument()
    expect(rows().every((row) => row.textContent?.includes('French'))).toBe(true)
  })

  it('shows an empty state with a way to start writing', async () => {
    // Arrange
    setMockMode('empty')
    // Act
    renderHistory()
    // Assert
    expect(await screen.findByText('No entries yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Write your first entry' })).toHaveAttribute('href', '/')
  })

  it('offers a retry when the list cannot load', async () => {
    // Arrange
    failWith('get', ENDPOINTS.entries)
    const user = userEvent.setup()
    renderHistory()
    expect(await screen.findByRole('alert')).toHaveTextContent(/on our side/)
    server.resetHandlers()
    // Act
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    // Assert
    expect(await screen.findByText('Showing 10 entries')).toBeInTheDocument()
  })

  it('keeps the loaded entries and explains when the next page fails', async () => {
    // Arrange
    server.use(
      http.get(apiUrl(ENDPOINTS.entries), ({ request }) =>
        new URL(request.url).searchParams.has('cursor') ? HttpResponse.json({ status: 500 }, { status: 500 }) : undefined,
      ),
    )
    const user = userEvent.setup()
    renderHistory()
    await screen.findByText('Showing 10 entries')
    // Act
    await user.click(screen.getByRole('button', { name: 'Load more' }))
    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(/on our side/)
    expect(rows()).toHaveLength(10)
  })
})
```

`frontend/src/features/history/EntryRow.test.tsx`:
```tsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { SEEDED } from '@/mocks/seed'
import { renderWithProviders } from '@/test/renderWithProviders'
import { HistoryList } from './HistoryList'

function rowContaining(text: string): HTMLElement {
  const row = within(screen.getByRole('list', { name: 'Entries' }))
    .getAllByRole('listitem')
    .find((item) => item.textContent?.includes(text))
  if (!row) throw new Error(`No row containing "${text}"`)
  return row
}

async function renderRows() {
  const user = userEvent.setup()
  renderWithProviders(<HistoryList />, { route: '/entries' })
  await screen.findByText('Showing 10 entries')
  return user
}

describe('history rows', () => {
  it('link to the entry and show date, language, preview and error count', async () => {
    // Arrange
    await renderRows()
    // Act
    const row = rowContaining('Hoy 😀 la problema')
    // Assert
    expect(within(row).getByRole('link')).toHaveAttribute('href', `/entries/${SEEDED.emoji}`)
    expect(row).toHaveTextContent(/Oct \d{1,2}, 2026/)
    expect(within(row).getByText('2 errors')).toBeInTheDocument()
  })

  it('mark entries that were never analysed', async () => {
    // Arrange
    await renderRows()
    // Act
    const row = rowContaining('Escribo esto antes de dormir')
    // Assert
    expect(within(row).getByText('Not analyzed')).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Get feedback' })).toBeInTheDocument()
  })

  it('retry a failed analysis in place', async () => {
    // Arrange
    const user = await renderRows()
    const row = rowContaining('Mañana voy a el cine')
    expect(within(row).getByText('Analysis failed')).toBeInTheDocument()
    // Act
    await user.click(within(row).getByRole('button', { name: 'Retry analysis' }))
    // Assert
    await waitFor(() => expect(within(rowContaining('Mañana voy a el cine')).getByText('1 error')).toBeInTheDocument())
  })
})
```

Run: `pnpm -C frontend test src/features/history`
Expected: FAIL — unresolved `./HistoryList`.

- [ ] **Step 4: Implement History**

`frontend/src/features/history/HistoryList.tsx`:
```tsx
import { useSearchParams } from 'react-router'
import { LanguageSelect } from '@/features/languages/LanguageSelect'
import { useEntriesQuery } from '@/hooks/queries/useEntriesQuery'
import { HistoryResults } from './HistoryResults'

// The filter lives in the URL so Back and shared links keep it.
export function HistoryList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const language = searchParams.get('language')
  const entries = useEntriesQuery(language)
  const changeLanguage = (code: string) => setSearchParams(code ? { language: code } : {})

  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-xs">
        <LanguageSelect id="history-language" label="Language" value={language ?? ''} onChange={changeLanguage} allLabel="All languages" />
      </div>
      <HistoryResults entries={entries} filtered={language !== null} />
    </div>
  )
}
```

`frontend/src/features/history/HistoryResults.tsx`:
```tsx
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { LoadingState } from '@/components/ui/LoadingState'
import { TextLink } from '@/components/ui/TextLink'
import type { useEntriesQuery } from '@/hooks/queries/useEntriesQuery'
import { toErrorMessage } from '@/utils/errorMessage'
import { pluralize } from '@/utils/formatter'
import { EntryRow } from './EntryRow'
import { LoadMore } from './LoadMore'

export interface HistoryResultsProps {
  entries: ReturnType<typeof useEntriesQuery>
  filtered: boolean
}

export function HistoryResults({ entries, filtered }: HistoryResultsProps) {
  if (entries.isPending) return <LoadingState label="Loading entries…" />
  // With pages already loaded, a failed "Load more" is reported next to its button instead.
  if (entries.isError && !entries.data) {
    return <ErrorState message={toErrorMessage(entries.error)} onRetry={() => void entries.refetch()} />
  }
  const items = entries.data ?? []
  if (items.length === 0) {
    return (
      <EmptyState title={filtered ? 'No entries in this language yet' : 'No entries yet'}>
        <TextLink to="/">Write your first entry</TextLink>
      </EmptyState>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      <ul aria-label="Entries" className="flex flex-col gap-3">
        {items.map((entry) => (
          <EntryRow key={entry.id} entry={entry} />
        ))}
      </ul>
      <p role="status" className="text-sm text-muted">
        Showing {pluralize(items.length, 'entry', 'entries')}
      </p>
      <LoadMore entries={entries} />
    </div>
  )
}
```

`frontend/src/features/history/LoadMore.tsx`:
```tsx
import { Button } from '@/components/ui/Button'
import type { useEntriesQuery } from '@/hooks/queries/useEntriesQuery'
import { toErrorMessage } from '@/utils/errorMessage'

export interface LoadMoreProps {
  entries: ReturnType<typeof useEntriesQuery>
}

export function LoadMore({ entries }: LoadMoreProps) {
  if (!entries.hasNextPage) return null
  return (
    <div className="flex flex-col items-start gap-2">
      {entries.isFetchNextPageError && (
        <p role="alert" className="text-sm text-danger">
          {toErrorMessage(entries.error)}
        </p>
      )}
      <Button onClick={() => void entries.fetchNextPage()} disabled={entries.isFetchingNextPage}>
        {entries.isFetchingNextPage ? 'Loading…' : 'Load more'}
      </Button>
    </div>
  )
}
```

`frontend/src/features/history/RetryAnalysisButton.tsx`:
```tsx
import { Button } from '@/components/ui/Button'
import { useRunAnalysisMutation } from '@/hooks/mutations/useRunAnalysisMutation'
import { toErrorMessage } from '@/utils/errorMessage'

export interface RetryAnalysisButtonProps {
  entryId: string
  label: string
  describedBy: string
}

export function RetryAnalysisButton({ entryId, label, describedBy }: RetryAnalysisButtonProps) {
  const analyze = useRunAnalysisMutation()
  return (
    <>
      <Button onClick={() => analyze.mutate(entryId)} disabled={analyze.isPending} aria-describedby={describedBy}>
        {analyze.isPending ? 'Analyzing…' : label}
      </Button>
      {analyze.isError && (
        <span role="alert" className="text-sm text-danger">
          {toErrorMessage(analyze.error)}
        </span>
      )}
    </>
  )
}
```

`frontend/src/features/history/EntryRow.tsx`:
```tsx
import { useId } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/Badge'
import { useLanguageName } from '@/features/languages/useLanguageName'
import type { EntrySummaryOut } from '@/types/entry'
import { formatDateTime, pluralize } from '@/utils/formatter'
import { RetryAnalysisButton } from './RetryAnalysisButton'

export interface EntryRowProps {
  entry: EntrySummaryOut
}

function EntryStatus({ entry }: EntryRowProps) {
  if (entry.latest_status === 'succeeded') {
    return <Badge tone={entry.error_count > 0 ? 'danger' : 'success'}>{pluralize(entry.error_count, 'error')}</Badge>
  }
  if (entry.latest_status === null) return <Badge>Not analyzed</Badge>
  // A pending latest analysis outlived its request (client went away mid-call), so it is as retryable as a failure.
  return <Badge tone="warning">{entry.latest_status === 'pending' ? 'Analysis interrupted' : 'Analysis failed'}</Badge>
}

export function EntryRow({ entry }: EntryRowProps) {
  const languageName = useLanguageName(entry.language)
  // The row's link describes its retry button, so several "Retry analysis" buttons stay distinguishable.
  const linkId = useId()
  return (
    <li className="flex flex-col gap-3 rounded-md border border-border p-4 md:flex-row md:items-center md:justify-between">
      <Link id={linkId} to={`/entries/${entry.id}`} className="flex min-w-0 flex-col gap-1 hover:underline">
        <span className="text-sm text-muted">
          {formatDateTime(entry.created_at)} · {languageName}
        </span>
        <span>{entry.preview}</span>
      </Link>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <EntryStatus entry={entry} />
        {entry.latest_status !== 'succeeded' && (
          <RetryAnalysisButton entryId={entry.id} label={entry.latest_status === null ? 'Get feedback' : 'Retry analysis'} describedBy={linkId} />
        )}
      </div>
    </li>
  )
}
```

Replace `frontend/src/pages/HistoryPage.tsx` with:
```tsx
import { HistoryList } from '@/features/history/HistoryList'

export function HistoryPage() {
  return (
    <div className="flex flex-col gap-6">
      <title>History · Language Journal</title>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">History</h1>
        <p className="text-muted">Every entry you have written, newest first.</p>
      </div>
      <HistoryList />
    </div>
  )
}
```

Run: `pnpm -C frontend test src/features/history`
Expected: PASS.

- [ ] **Step 5: Write the failing detail tests**

`frontend/src/features/entry-detail/EntryDetail.test.tsx`:
```tsx
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { SEEDED } from '@/mocks/seed'
import { renderWithProviders } from '@/test/renderWithProviders'
import { EntryDetail } from './EntryDetail'

const renderDetail = (id: string) => {
  renderWithProviders(<EntryDetail entryId={id} />)
  return userEvent.setup()
}

describe('EntryDetail', () => {
  it('shows a loading state, then the entry and its latest feedback', async () => {
    // Arrange + Act
    renderDetail(SEEDED.revisedFrench)
    // Assert
    expect(screen.getByRole('status')).toHaveTextContent('Loading entry…')
    expect(await screen.findByText('Great job — no mistakes found!')).toBeInTheDocument()
    expect(await screen.findByText(/French · .* · 8 words/)).toBeInTheDocument()
  })

  it('switches to an earlier analysis, which keeps its own text and highlights', async () => {
    // Arrange
    const user = renderDetail(SEEDED.revisedFrench)
    const switcher = await screen.findByLabelText('Analysis')
    const [latest, older] = within(switcher).getAllByRole<HTMLOptionElement>('option')
    expect(latest?.textContent).toMatch(/0 errors \(latest\)$/)
    // Act
    await user.selectOptions(switcher, older?.value ?? '')
    // Assert
    expect(await screen.findByRole('button', { name: /à le/ })).toBeInTheDocument()
  })

  it('retries a failed analysis', async () => {
    // Arrange
    const user = renderDetail(SEEDED.failed)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The AI took too long to respond.')
    // Act
    await user.click(within(alert).getByRole('button', { name: 'Retry analysis' }))
    // Assert
    expect(await screen.findByRole('heading', { name: 'Feedback' })).toBeInTheDocument()
  })

  it('offers feedback for an entry that was never analysed', async () => {
    // Arrange
    const user = renderDetail(SEEDED.unanalysed)
    // Act
    await user.click(await screen.findByRole('button', { name: 'Get feedback' }))
    // Assert
    expect(await screen.findByRole('heading', { name: 'Feedback' })).toBeInTheDocument()
  })

  it('explains an entry that does not exist', async () => {
    // Arrange + Act
    renderDetail('missing')
    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't find that entry.")
  })

  it('revises the entry and selects the new analysis', async () => {
    // Arrange
    const user = renderDetail(SEEDED.emoji)
    await user.click(await screen.findByRole('button', { name: 'Revise & re-check' }))
    const editor = screen.getByLabelText('Revise your entry')
    // Act
    await user.clear(editor)
    await user.type(editor, 'Hoy fue difícil, pero soy optimista.')
    await user.click(screen.getByRole('button', { name: 'Re-check' }))
    // Assert
    expect(await screen.findByText('Great job — no mistakes found!')).toBeInTheDocument()
    expect(screen.getByLabelText('Analysis')).toHaveDisplayValue(/\(latest\)$/)
  })
})
```

Run: `pnpm -C frontend test src/features/entry-detail`
Expected: FAIL — unresolved `./EntryDetail`.

- [ ] **Step 6: Implement the detail feature**

`frontend/src/features/entry-detail/EntryHeader.tsx`:
```tsx
import { TextLink } from '@/components/ui/TextLink'
import { useLanguageName } from '@/features/languages/useLanguageName'
import type { EntryOut } from '@/types/entry'
import { formatDateTime, pluralize } from '@/utils/formatter'

export interface EntryHeaderProps {
  entry: EntryOut
}

export function EntryHeader({ entry }: EntryHeaderProps) {
  const languageName = useLanguageName(entry.language)
  return (
    <div className="flex flex-col items-start gap-1">
      <p className="text-sm text-muted">
        {languageName} · {formatDateTime(entry.created_at)} · {pluralize(entry.word_count, 'word')}
      </p>
      <TextLink to="/entries">Back to history</TextLink>
    </div>
  )
}
```

`frontend/src/features/entry-detail/AnalysisSwitcher.tsx`:
```tsx
import { useId } from 'react'
import { Field } from '@/components/ui/Field'
import { Select } from '@/components/ui/Select'
import type { AnalysisOut } from '@/types/analysis'
import { formatDateTime, pluralize } from '@/utils/formatter'

export interface AnalysisSwitcherProps {
  analyses: readonly AnalysisOut[]
  value: string
  onChange: (id: string) => void
}

function optionLabel(analysis: AnalysisOut, latest: boolean): string {
  const errors = analysis.mistakes.filter((mistake) => mistake.kind === 'error').length
  const outcome = analysis.status === 'succeeded' ? pluralize(errors, 'error') : analysis.status === 'pending' ? 'interrupted' : 'failed'
  return `${formatDateTime(analysis.created_at)} — ${outcome}${latest ? ' (latest)' : ''}`
}

export function AnalysisSwitcher({ analyses, value, onChange }: AnalysisSwitcherProps) {
  const id = useId()
  return (
    <div className="max-w-md">
      <Field label="Analysis" htmlFor={id}>
        <Select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
          {analyses.map((analysis, index) => (
            <option key={analysis.id} value={analysis.id}>
              {optionLabel(analysis, index === 0)}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  )
}
```

`frontend/src/features/entry-detail/DetailAnalysis.tsx`:
```tsx
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { RevisableFeedback } from '@/features/editor/RevisableFeedback'
import { AnalysisFailure } from '@/features/feedback/AnalysisFailure'
import { useRunAnalysisMutation } from '@/hooks/mutations/useRunAnalysisMutation'
import type { AnalysisOut } from '@/types/analysis'
import type { EntryOut } from '@/types/entry'

export interface DetailAnalysisProps {
  entry: EntryOut
  analysis: AnalysisOut | null
  onNewAnalysis: () => void
}

export function DetailAnalysis({ entry, analysis, onNewAnalysis }: DetailAnalysisProps) {
  const analyze = useRunAnalysisMutation()
  const run = () => analyze.mutate(entry.id, { onSuccess: onNewAnalysis })
  if (analysis?.status === 'succeeded') {
    return <RevisableFeedback entry={entry} analysis={analysis} onRevised={onNewAnalysis} />
  }
  if (analysis || analyze.isError) {
    return <AnalysisFailure analysis={analysis} requestError={analyze.error} isRetrying={analyze.isPending} onRetry={run} />
  }
  return (
    <EmptyState title="No feedback yet">
      <p className="whitespace-pre-wrap">{entry.text}</p>
      <Button variant="primary" onClick={run} disabled={analyze.isPending}>
        {analyze.isPending ? 'Analyzing…' : 'Get feedback'}
      </Button>
    </EmptyState>
  )
}
```

`frontend/src/features/entry-detail/EntryDetail.tsx`:
```tsx
import { useState } from 'react'
import { ErrorState } from '@/components/ui/ErrorState'
import { LoadingState } from '@/components/ui/LoadingState'
import { useAnalysesQuery } from '@/hooks/queries/useAnalysesQuery'
import { useEntryQuery } from '@/hooks/queries/useEntryQuery'
import type { AnalysisOut } from '@/types/analysis'
import type { EntryDetailOut } from '@/types/entry'
import { toErrorMessage } from '@/utils/errorMessage'
import { AnalysisSwitcher } from './AnalysisSwitcher'
import { DetailAnalysis } from './DetailAnalysis'
import { EntryHeader } from './EntryHeader'

export interface EntryDetailProps {
  entryId: string
}

function EntryDetailReady({ entry, analyses }: { entry: EntryDetailOut; analyses: AnalysisOut[] }) {
  // null means "the newest", so a new analysis is selected as soon as it lands in the cache.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = analyses.find((analysis) => analysis.id === selectedId) ?? analyses[0] ?? null
  return (
    <div className="flex flex-col gap-6">
      <EntryHeader entry={entry} />
      {analyses.length > 1 && <AnalysisSwitcher analyses={analyses} value={selected?.id ?? ''} onChange={setSelectedId} />}
      <DetailAnalysis key={selected?.id ?? 'none'} entry={entry} analysis={selected} onNewAnalysis={() => setSelectedId(null)} />
    </div>
  )
}

export function EntryDetail({ entryId }: EntryDetailProps) {
  const entry = useEntryQuery(entryId)
  const analyses = useAnalysesQuery(entryId)
  if (entry.isError) return <ErrorState message={toErrorMessage(entry.error)} onRetry={() => void entry.refetch()} />
  if (analyses.isError) return <ErrorState message={toErrorMessage(analyses.error)} onRetry={() => void analyses.refetch()} />
  if (entry.isPending || analyses.isPending) return <LoadingState label="Loading entry…" />
  return <EntryDetailReady entry={entry.data} analyses={analyses.data} />
}
```

Replace `frontend/src/pages/EntryDetailPage.tsx` with:
```tsx
import { useParams } from 'react-router'
import { EntryDetail } from '@/features/entry-detail/EntryDetail'

export function EntryDetailPage() {
  const { entryId = '' } = useParams()
  return (
    <div className="flex flex-col gap-6">
      <title>Entry · Language Journal</title>
      <h1 className="text-2xl font-bold">Entry</h1>
      <EntryDetail key={entryId} entryId={entryId} />
    </div>
  )
}
```

Run: `pnpm -C frontend test`
Expected: PASS.

- [ ] **Step 7: Write the e2e journey**

`frontend/e2e/history.spec.ts`:
```ts
import { expect, test, type Page } from '@playwright/test'
import { expectNoA11yViolations } from './a11y'
import { expectButtonsShowPointer } from './cursor'

async function expectHealthy(page: Page): Promise<void> {
  await expectNoA11yViolations(page)
  await expectButtonsShowPointer(page)
}

test('history filters and pages, then opens an entry whose past analyses can be switched', async ({ page }) => {
  // Arrange
  await page.goto('/entries')
  const rows = page.getByRole('list', { name: 'Entries' }).getByRole('listitem')
  await expect(rows).toHaveCount(10)
  await expectHealthy(page)
  // Act
  await page.getByRole('button', { name: 'Load more' }).click()
  await expect(rows).toHaveCount(14)
  await page.getByLabel('Language').selectOption('fr')
  await expect(rows).toHaveCount(4)
  await expectHealthy(page)
  await page.getByRole('link', { name: /Je suis allé au marché/ }).click()
  // Assert
  await expect(page.getByRole('heading', { level: 1, name: 'Entry' })).toBeVisible()
  await expect(page.getByText('Great job — no mistakes found!')).toBeVisible()
  await expectHealthy(page)
  await page.getByLabel('Analysis').selectOption({ index: 1 })
  await expect(page.getByRole('button', { name: /à le/ })).toBeVisible()
  await expectHealthy(page)
})

test('history shows an empty state when there are no entries', async ({ page }) => {
  // Arrange
  await page.goto('/entries?mock=empty')
  // Act
  const link = page.getByRole('link', { name: 'Write your first entry' })
  // Assert
  await expect(link).toBeVisible()
  await expectHealthy(page)
})
```

- [ ] **Step 8: Gates**

Run: `make verify`
Expected: `ALL GATES GREEN`.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/ui/LoadingState frontend/src/components/ui/EmptyState frontend/src/utils/formatter.ts \
  frontend/src/utils/formatter.test.ts frontend/DESIGN.md frontend/src/features/languages frontend/src/features/history \
  frontend/src/features/entry-detail frontend/src/pages/HistoryPage.tsx frontend/src/pages/EntryDetailPage.tsx \
  frontend/e2e/history.spec.ts
git commit -m "feat(frontend): History with language filter and cursor paging; entry detail with past-analyses switcher"
```

---

### Task 7: Full-stack Playwright smoke against the Compose stack

**Files:**
- Create: `frontend/playwright.stack.config.ts`, `frontend/e2e-stack/journal.spec.ts`, `docker-compose.e2e.yml`
- Modify: `frontend/package.json` (script `e2e:stack`), `frontend/tsconfig.node.json`, `frontend/tsconfig.test.json`, `frontend/eslint.config.js`, `frontend/.fallowrc.json`, `Makefile`, `.github/workflows/ci.yml`, `CLAUDE.md`, `frontend/CLAUDE.md`

**Interfaces:**
- Consumes: the whole UI (Tasks 3–6); `expectNoA11yViolations`, `expectButtonsShowPointer` (`frontend/e2e/`); `scripts/wait-for-url.sh`; the backend's demo `FakeProvider` (`ai/journal_ai/providers/fake.py`): for "Ayer yo es feliz en el [park]." it returns summary "Demo feedback — configure Claude for real corrections.", an `error` "yo es" → "yo soy" (verb conjugation) and a `vocab_help` "[park]" → "park".
- Produces: `pnpm -C frontend e2e:stack` (baseURL from `STACK_URL`, default `http://localhost:8080`, no webServer); `make e2e-stack` (compose project `journal-e2e` with `AI_PROVIDER=fake`, wait, run, tear down with volumes); CI job `e2e-stack` running it.

- [ ] **Step 1: Write the smoke spec and its config**

`frontend/playwright.stack.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test'

// Drives an already running Compose stack (nginx + backend + Postgres); `make e2e-stack` starts and stops it.
export default defineConfig({
  testDir: 'e2e-stack',
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: process.env.STACK_URL ?? 'http://localhost:8080',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 375, height: 812 } } },
  ],
})
```

`frontend/e2e-stack/journal.spec.ts`:
```ts
import { expect, test } from '@playwright/test'
import { expectNoA11yViolations } from '../e2e/a11y'
import { expectButtonsShowPointer } from '../e2e/cursor'

const DEMO_SUMMARY = 'Demo feedback — configure Claude for real corrections.'

test('the real stack saves an entry, returns demo feedback and lists it in history', async ({ page }, testInfo) => {
  // Arrange — a unique entry per run and project, because the stack's database outlives one test.
  const text = `Ayer yo es feliz en el [park]. (${testInfo.project.name} ${Date.now()})`
  await page.goto('/')
  await expect(page).toHaveTitle('Write · Language Journal')
  await page.getByLabel('Language').selectOption('es')
  await page.getByLabel('Your entry').fill(text)
  // Act
  await page.getByRole('button', { name: 'Get feedback' }).click()
  // Assert
  await expect(page.getByText(DEMO_SUMMARY)).toBeVisible()
  await page.getByRole('button', { name: /yo es/ }).click()
  await expect(page.getByRole('region', { name: /should be yo soy/ })).toContainText('Verb conjugation')
  await expectNoA11yViolations(page)
  await expectButtonsShowPointer(page)
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'History' }).click()
  const row = page.getByRole('listitem').filter({ hasText: text })
  await expect(row).toContainText('1 error')
  await row.getByRole('link').click()
  await expect(page.getByText(DEMO_SUMMARY)).toBeVisible()
  await expectNoA11yViolations(page)
})
```

Add to `frontend/package.json` scripts (after `"e2e"`):
```json
    "e2e:stack": "playwright test -c playwright.stack.config.ts",
```

Coverage of the new files by the static gates:
- `frontend/tsconfig.node.json` `include`: add `"playwright.stack.config.ts"`.
- `frontend/tsconfig.test.json` `include`: `["src", "e2e", "e2e-stack"]`.
- `frontend/eslint.config.js`: change the test override's `files` to `['**/*.test.{ts,tsx}', 'e2e/**/*.ts', 'e2e-stack/**/*.ts']`.
- `frontend/.fallowrc.json` `entry`: add `"e2e-stack/**/*.ts"` and `"playwright.stack.config.ts"`.

`pnpm e2e` keeps `testDir: 'e2e'`, so it never picks up `e2e-stack/`.

- [ ] **Step 2: Run it without a stack to see it fail**

Run: `pnpm -C frontend e2e:stack`
Expected: FAIL — `net::ERR_CONNECTION_REFUSED at http://localhost:8080/`.

- [ ] **Step 3: Compose overlay and Make target**

`docker-compose.e2e.yml`:
```yaml
# Overlay for `make e2e-stack`: always the deterministic demo provider, whatever keys the local env file holds.
services:
  backend:
    environment:
      AI_PROVIDER: fake
```

In `Makefile`: add `e2e-stack` to `.PHONY`, and append:
```make
# Own compose project and volume, so the run never touches the dev database; still needs ports 5432/8000/8080 free.
E2E_STACK := docker compose -p journal-e2e -f docker-compose.yml -f docker-compose.e2e.yml

e2e-stack:
	$(E2E_STACK) up -d --build
	./scripts/wait-for-url.sh http://localhost:8080/health 240 || { $(E2E_STACK) logs; $(E2E_STACK) down -v; exit 1; }
	pnpm -C frontend e2e:stack; status=$$?; [ $$status -eq 0 ] || $(E2E_STACK) logs backend; $(E2E_STACK) down -v; exit $$status
```

- [ ] **Step 4: Run it against the stack**

Run: `make e2e-stack` (Docker running; stop any `make up` stack first)
Expected: `2 passed` (desktop + mobile), then the `journal-e2e` containers and volume are removed.

- [ ] **Step 5: CI job and docs**

In `.github/workflows/ci.yml`, replace the `e2e-stack` job's `steps` with (this file is local-only — the GitHub token lacks the workflow scope — so edit it but never stage it):
```yaml
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          package_json_file: frontend/package.json
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
          cache-dependency-path: frontend/pnpm-lock.yaml
      - run: pnpm -C frontend install --frozen-lockfile
      - run: pnpm -C frontend exec playwright install --with-deps chromium
      - run: make e2e-stack
```

Root `CLAUDE.md`, `## Commands` second line: append ` · \`make e2e-stack\` (Compose + fake AI + Playwright smoke)`.
`frontend/CLAUDE.md`, `## Commands` first line: append ` · \`pnpm e2e:stack\` (against a running stack; prefer \`make e2e-stack\`)`.

- [ ] **Step 6: Gates**

Run: `make verify`
Expected: `ALL GATES GREEN` (`make e2e-stack` is a separate CI job, like before, because it needs Docker).

- [ ] **Step 7: Commit**

```bash
git add frontend/playwright.stack.config.ts frontend/e2e-stack frontend/package.json frontend/tsconfig.node.json \
  frontend/tsconfig.test.json frontend/eslint.config.js frontend/.fallowrc.json docker-compose.e2e.yml Makefile \
  CLAUDE.md frontend/CLAUDE.md
git commit -m "test(e2e): full-stack Playwright smoke against Compose with the fake AI provider"
```

---

### Task 8: Phase checkpoint

**Files:**
- Modify: `docs/superpowers/plans/2026-10-10-00-index.md`; any file a BLOCKING finding names.
- Create: `docs/qa/p3-*.png` (ui-qa screenshots).

**Interfaces:**
- Consumes: everything above.
- Produces: P3 marked done in the index, with evidence.

- [ ] **Step 1: Full gate**

Run: `make verify` then `make e2e-stack`
Expected: `ALL GATES GREEN`, then `2 passed`. Keep both outputs for the report.

- [ ] **Step 2: ui-qa**

Dispatch the `ui-qa` agent (it builds `--mode mock` and serves `http://localhost:4173`) with these acceptance criteria, at 1280×800 and 375×812, keyboard pass included. `?mock=` modes apply only to the URL they are loaded on, so load each URL directly.
1. Shell: brand "Language Journal", nav Write/History with the current page marked; the first Tab shows "Skip to content", which moves focus to the main content; `/nowhere` shows "Page not found" with "Back to writing".
2. Write: the language picker lists Spanish, French, German, Italian, Portuguese; the chosen language is preselected after a reload.
3. Write: the text box shows a live word count and the `[brackets]` hint; the draft survives a reload ("Draft kept on this device"); "Get feedback" is disabled while the box is empty.
4. Write: "Get feedback" and ⌘/Ctrl+Enter save, then analyse — status "Saved. Analyzing…" then "Saved"; the button is disabled while pending; feedback appears.
5. Feedback: summary; legend with a count per kind; highlights differ by colour and underline style (wavy error, dashed suggestion, dotted word help); each highlight is reachable by Tab and opens a panel with original → correction, category chip and explanation; Escape closes it and focus returns to the highlight.
6. Feedback: "Show corrected version" toggles (`aria-pressed`) between annotated and corrected text; the seeded entry "El fin de semana fue muy bueno…" (open it from History) lists its unplaceable note under "Other notes".
7. Failure: on `/?mock=analysis-fail`, "Get feedback" shows an alert that the AI took too long and the entry is saved; the text stays; "Retry analysis" produces feedback.
8. Revise: "Revise & re-check" opens the editor with the text, "Re-check" shows the new feedback; "New entry" gives an empty, focused text box.
9. History: rows show date, language, preview and an error-count or status badge; "Load more" adds the remaining entries; the language filter narrows the list; the failed row's "Retry analysis" turns into an error-count badge; `/entries?mock=empty` shows the empty state with a link; `/entries?mock=error` shows an error with "Try again"; `/entries?mock=slow` shows "Loading entries…".
10. Detail: opening "Je suis allé au marché avec ma sœur." shows the latest feedback; the "Analysis" switcher (newest first) selects the earlier analysis, which shows its own text with the "à le" highlight; "Revise & re-check" adds a new latest analysis.
11. Everywhere: no horizontal scroll at 375px; focus always visible; highlights stay legible with `prefers-color-scheme: dark`; no console errors outside `?mock=error`.

- [ ] **Step 3: Reviewer**

Dispatch the `reviewer` agent on the P3 commit range (Task 1 commit through Task 7 commit) with this plan and the spec. Fix every BLOCKING finding — failing test first, `make verify` green — one commit per fix (`fix(frontend): <finding>`), then re-run the affected ui-qa criteria. Record SHOULD findings in the index row for P4.

- [ ] **Step 4: Mark P3 done**

In `docs/superpowers/plans/2026-10-10-00-index.md`, replace the P3 row with:
```
| P3 Frontend Stage 1 | `2026-10-10-p3-frontend-stage1.md` | done (Vitest + Playwright + axe + Lighthouse green; full-stack smoke green) |
```

```bash
git add docs/superpowers/plans/2026-10-10-00-index.md docs/qa
git commit -m "docs: P3 frontend stage 1 done"
```
Paste the `make verify` tail, the `make e2e-stack` result, the ui-qa table and the reviewer verdict into the phase report.

---

## Self-review notes

- Spec §7 Write: language picker + memory (T5), live word count + bracket hint (T5 `EntryTextField`), autosaved draft (T5 `useLocalStorage`), button and ⌘/Ctrl+Enter (T5), disabled while pending + `aria-live` "Analyzing…" (T5 `WriteStatus`), "Saved" (T5), failure keeps entry + "Retry analysis" (T4 `AnalysisFailure`, T5). Feedback view items (T4). History/Detail (T6). Insights is P4: only `NAV_ITEMS` leaves room (T3).
- Spec §6 offsets as code points: `segmentText` (T4) and the mock analyzer (T1) both use `Array.from`; the mock-API contract test pins alignment for every seeded analysis.
- Spec §10 frontend + full stack: Vitest/RTL/MSW per feature (T2–T6), Playwright + axe desktop/mobile (T3, T5, T6), Compose smoke (T7).
- Type names used across tasks: `journalKeys`, `useEntriesQuery`, `useEntryQuery`, `useAnalysesQuery`, `useLanguagesQuery`, `useCreateEntryMutation`, `useUpdateEntryMutation`, `useRunAnalysisMutation`, `placeMistakes`/`segmentText`/`PlacedMistake`, `FeedbackView`, `AnalysisFailure`, `RevisableFeedback`, `ReviseEditor`, `EntryTextField`, `LanguageSelect`, `useLanguageName`, `WritePhase`, `Draft`, `WriteSession`, `SEEDED`, `STORAGE_KEYS`, `PAGE_SIZE`.


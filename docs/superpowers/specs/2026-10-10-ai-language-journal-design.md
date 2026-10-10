# AI-Assisted Language Journal — Design Spec

Date: 2026-10-10 · Status: approved in brainstorming, pending written-spec review

## 1. Context and goal

Take-home for Applied Computing (`appliedcomputingtech/senior-fullstack-take-home-2`): a web app where a single user
writes journal entries in a language they are learning, gets AI feedback, reviews past entries (Stage 1, required) and
sees how their mistakes evolve (Stage 2, bonus). Deliverables: this repo, a Loom walkthrough, and a deep-dive call.

Graded on: product judgment, API + data model, AI integration and handling, correction/review UX, code clarity,
tests, scoping and README. "A coherent, well-reasoned product slice" beats feature count.

Success for us:
- Stage 1 and Stage 2 complete, every required test area covered, all gates green in CI.
- `docker compose up` runs the full app with no API key (`AI_PROVIDER=fake`) and with Claude when a key is set.
- Every technology choice has a one-line justification in the README; every omission is listed.
- The repo carries its own agent harness (rules, agents, hooks, gates) so quality is enforced, not prompted.

## 2. Product decisions

| Decision | Choice | Why |
|---|---|---|
| Feedback timing | Post-writing only | Live correction interrupts flow — the friction the brief warns about |
| Writing aid | `[English word]` bracket fallback; AI fills it in as `vocab_help` | Keeps the learner writing; tiny to build; teaches the word |
| Correction kinds | `error` (grammar/spelling), `suggestion` (style/naturalness), `vocab_help` | Only errors count toward progress, so style tips don't inflate "mistakes" |
| Presentation | Inline highlights on the original text + detail panel; toggle for full corrected version; unplaceable items under "Other notes" | Learner sees mistakes in their own words; nothing silently dropped |
| Save model | Save first, analyze second; auto-saved, no Save button | Writing is never lost if the AI fails |
| Revision loop | "Revise & re-check" edits text and creates a new analysis | Encourages self-correction; analyses stay historical |
| Languages | Multiple: `es, fr, de, it, pt` (config list) | Language is a column; universal taxonomy keeps insights comparable |
| Taxonomy | Fixed enum (below); unknown → `other` | Free-form categories cannot be aggregated |
| Insights summary | Deterministic sentences from numbers | Testable, cannot hallucinate |

Categories: `verb_conjugation, verb_tense, gender_agreement, number_agreement, article, preposition, word_order,
spelling, vocabulary, punctuation, other`.

Deliberately left out (README lists each with reason): auth/multi-user, delete, live grammar checking, autocomplete,
severity scores, background job queue, streaming, vector DB/embeddings, LangChain/LangGraph, GraphQL, deployment target.

## 3. Architecture

```
Browser (Vite + React SPA)
   │ REST/JSON (TanStack Query + ky)
   ▼
FastAPI ── api/routes → services → repositories → SQLAlchemy (async, asyncpg) → Postgres
   │                       └── journal_ai package: prompt → Claude → parse → retry → align
   ├── structlog JSON logs (request_id)
   └── Sentry (BE + FE, DSN-gated) · Langfuse tracing (key-gated)
```

Stack: Vite + React 19 + TS strict + Tailwind v4 (ported frontend starter kit) · FastAPI · Pydantic v2 · SQLAlchemy 2 async ·
Alembic · Postgres 16 · `anthropic` Python SDK · uv workspace · pnpm · Docker Compose · GitHub Actions.

Analysis execution: synchronous request with timeout and one parse retry. Scaling path (README): the
`analyses.status` column already models `pending/succeeded/failed`, so moving to a queue (arq + Redis) changes only
the trigger.

### Repo layout

```
applied-computing-journal/
├── CLAUDE.md · README.md · Makefile · docker-compose.yml · pyproject.toml (uv workspace)
├── .claude/{agents,hooks,rules,settings.json} · .github/workflows/{ci.yml,cd.yml}
├── frontend/   src/{components,features,pages,hooks/{queries,mutations,misc},utils,providers,mocks,styles}, e2e/
├── backend/
│   ├── app/main.py                 app factory
│   ├── app/core/                   config, logging, sentry, errors
│   ├── app/db/                     session, base, models/{entry,analysis,mistake}
│   ├── app/repositories/           entry, analysis, insights
│   ├── app/services/               entry, analysis, insights/{service,calculations}
│   ├── app/api/                    deps, v1/routes/*, schemas/*
│   ├── migrations/                 Alembic
│   └── tests/{unit,integration}
├── ai/
│   ├── journal_ai/                 schema, prompts/v1, providers/{base,anthropic,fake}, parsing, alignment, analyzer, tracing
│   ├── evals/                      dataset.json, run.py
│   └── tests/
└── docs/superpowers/{specs,plans}
```

Layering rules (import-linter in CI): `api → services → repositories → db`. Routes never touch the ORM;
repositories hold no business rules; services depend on the `Analyzer` protocol, never on a provider. `journal_ai`
imports nothing from `backend` and knows nothing about DB or HTTP. Dependencies are injected via FastAPI `Depends`.

## 4. Data model

UUID primary keys, `timestamptz`, managed by Alembic.

**entries** — `id, language (check in supported list), text, word_count, created_at, updated_at`.
Index `(language, created_at)`.

**analyses** — `id, entry_id → entries (cascade), status (pending|succeeded|failed), input_text, corrected_text,
feedback_summary, model, prompt_version, raw_response (JSONB, nullable), error_code (provider_timeout|invalid_output|
provider_error, nullable), latency_ms, input_tokens, output_tokens, created_at, completed_at`.
`input_text` snapshots what was analyzed so offsets stay valid after the entry is edited. Index `(entry_id, created_at)`.

**mistakes** — `id, analysis_id → analyses (cascade), kind (error|suggestion|vocab_help), category, original,
correction, explanation, start_offset, end_offset (both null when unaligned), position`.
Indexes `(analysis_id)`, `(category)`.

Insights read only the latest succeeded analysis per entry, so re-analysis never double-counts.

## 5. API (`/api/v1`)

| Method | Path | Behaviour |
|---|---|---|
| GET | `/health` | Liveness + DB ping (unversioned) |
| GET | `/languages` | Supported languages |
| POST | `/entries` | `{language, text}` → 201 Entry |
| GET | `/entries?language=&cursor=&limit=` | Paged list (cursor on `(created_at, id)`, default 20, max 50) with latest analysis status + error count |
| GET | `/entries/{id}` | Entry + latest analysis with mistakes |
| PATCH | `/entries/{id}` | `{text}` → updated Entry |
| POST | `/entries/{id}/analyses` | Runs analysis synchronously → 201 Analysis (status `succeeded` or `failed` + `error_code`) |
| GET | `/entries/{id}/analyses` | Analysis history, newest first |
| GET | `/insights?language=` | Stage 2 payload |

Validation: text 1–5000 chars after trim, language in supported list → 422 otherwise; unknown id → 404.
Errors use RFC 7807 `application/problem+json` including `request_id`. A failed AI call is persisted, not thrown:
the analysis is a resource and its outcome is data.

## 6. AI pipeline (`journal_ai`)

`Analyzer.analyze(text, language) → AnalysisOutcome` (result or failure, plus raw response, usage, latency, retried).

1. Build prompt from `prompts/v1` (`PROMPT_VERSION = "v1"`). System prompt: language tutor for the given language;
   fixed categories; kinds; `[brackets]` → `vocab_help`; one-line English explanations; one encouraging
   `feedback_summary`; never flag correct text; entry text delimited and treated as data (prompt-injection defence).
2. `provider.complete(system, user, json_schema)` → raw text + usage.
   - `AnthropicProvider`: async `anthropic` SDK, `AI_MODEL` default `claude-opus-5-5`, explicit
     `output_config.effort` (default `medium`, tuned by evals), structured outputs via `output_config.format` with
     a JSON schema generated from the Pydantic model; SDK `max_retries=2`; request timeout 30s; checks
     `stop_reason == "refusal"` first. Server-side model fallbacks are intentionally off.
   - `FakeProvider`: scripted outputs (valid, fenced, truncated, wrong types, unknown category, unfindable snippet,
     timeout). Selected by `AI_PROVIDER=fake`.
3. `parse_analysis(raw)` — provider-agnostic defensive layer: strip code fences/stray text, `json.loads`, validate
   top-level (`corrected_text`, `feedback_summary`, `mistakes[]`) or raise `InvalidOutput`; validate each mistake
   independently, drop invalid ones (counted + logged), map unknown category → `other`, drop `original == correction`,
   de-duplicate.
4. `align_mistakes(text, mistakes)` — left-to-right cursor search so repeated snippets map to the right occurrence;
   fallback whitespace/case-normalised match; else offsets `null`.
5. On `InvalidOutput`: one retry with the validation error appended; then failure `invalid_output`.
   Timeout → `provider_timeout`; API errors and refusals → `provider_error`. Raw response stored whenever present.

Tracing: Langfuse wraps `analyze()` only when `LANGFUSE_PUBLIC_KEY` is set. Model, latency and tokens are always logged.

Evals (`ai/evals`, `make eval`): ~15 labelled entries per language (es, fr initially) plus clean sentences; reports
expected-mistake recall, category accuracy, false-positive rate, p50 latency; optional Langfuse push. Results go in the README.

## 7. Frontend

Kit conventions: `components/` pure library · `features/` composition · data only via `hooks/queries|mutations` ·
semantic Tailwind tokens · loading/empty/error/ready states · keyboard operable · 375px and 1280px ·
`prefers-reduced-motion`. React Router for three routes. MSW mocks back dev and tests (`?mock=error|empty|slow`).

**Write (`/`)** — language picker (last used remembered), textarea with live word count and bracket hint, draft
autosaved to localStorage, "Get feedback" (button or ⌘/Ctrl+Enter) → create then analyze; disabled while pending;
`aria-live` "Analyzing…". Feedback view: summary, annotated text (kind encoded by colour and underline style),
focusable highlights opening a panel (original → correction, category chip, explanation), corrected-version toggle,
"Other notes", legend counts, "Revise & re-check", "New entry", "Saved" status. Failure: entry kept, "Retry analysis".

**History (`/entries`, `/entries/:id`)** — language filter, "Load more" cursor paging, rows with date, preview,
error-count badge, status (retry on failed). Detail reuses `FeedbackView` with a past-analyses switcher.

**Insights (`/insights`)** — language filter, headline summary, errors-per-100-words SVG line (no chart dependency),
category table (earlier vs recent rate, trend arrow, recurring badge, latest example), empty state below 3 entries.

## 8. Stage 2 insights logic

Pure functions in `backend/app/services/insights/calculations.py`; a single repository query supplies, per entry
with a latest succeeded analysis: `created_at, word_count, error counts by category, latest example per category`.
Only `kind = error` counts.

- Rate = errors per 100 words, pooled per window (Σ errors / Σ words × 100).
- Order entries by `created_at`; `recent` = last ⌈n/2⌉ (cap 5), `earlier` = the ⌊n/2⌋ before it (cap 5).
- n < 3 → `insufficient_data`. n = 3 → totals + recurring only. n ≥ 4 → trends.
- Trend: `delta = recent − earlier`; threshold `max(0.5, 0.25 × earlier)`; `delta ≤ −threshold` improving,
  `delta ≥ threshold` worsening, else stable. Constants named and documented.
- Recurring: category present in ≥ 3 of the last 5 entries.
- Summary: template sentences from the computed numbers, e.g. "Gender agreement is improving (4.1 → 1.8 per 100
  words). Prepositions keep recurring: 4 of your last 5 entries."

## 9. Observability

- structlog: JSON in prod, console in dev. Middleware binds `request_id` (honours incoming `X-Request-ID`, echoes it),
  logs method, path, status, duration. Analysis log line: `entry_id, analysis_id, model, prompt_version, latency_ms,
  tokens, mistakes_kept, mistakes_dropped, retried, status`. Entry text is never logged.
- Sentry (only when DSN set): backend FastAPI integration, `release` = git SHA, `request_id` tag,
  `send_default_pii=False`, `before_send` strips entry text, `invalid_output` captured as warning. Frontend
  `@sentry/react` error boundary, lazy-initialised.

## 10. Testing

| Area | Tests |
|---|---|
| AI parsing | Table-driven `parse_analysis` cases; alignment (accents/Unicode, repeated snippets, normalised fallback, not found); analyzer retry → success, retry → failure, timeout, refusal with `FakeProvider` |
| Main backend flow | Integration against real Postgres + `FakeProvider`: create → analyze → store → retrieve; failed analysis persisted; re-analysis; validation 422/404; paging |
| Stage 2 | Unit tests on calculations: n < 3, n = 3, n ≥ 4, zero words, pooled rates, threshold edges, recurring at exactly 3/5; integration test for `/insights` latest-analysis rule |
| Frontend | Vitest + Testing Library + MSW for features; Playwright + axe at 375/1280 |
| Full stack | Compose with fake provider + Playwright smoke: write → feedback → history → insights |

Tests run on Postgres only (per-test transaction rollback), never SQLite. Backend coverage floor 85%.

## 11. CI/CD

`ci.yml` on push/PR, parallel jobs: `ai` (ruff, mypy strict, pytest) · `backend` (ruff, mypy strict, import-linter,
`alembic upgrade head` + `alembic check`, pytest + coverage with Postgres service) · `frontend` (`pnpm verify`) ·
`e2e-stack` (compose up with fake provider + Playwright smoke) · `hygiene` (grep proves no leaked keys or private
wording in the repo).
`cd.yml` on `main`: build and push backend/frontend images to GHCR tagged with SHA; create Sentry release.

## 12. Agent harness

- Root `CLAUDE.md` (monorepo commands, layering, comments policy: comment why, not what; no comments restating code)
  plus `frontend/CLAUDE.md` (kit, cleaned), `backend/CLAUDE.md`, `ai/CLAUDE.md`.
- Path-scoped rules in `.claude/rules/`: backend layering, AI parsing, FE components/state/styling/tests.
- Agents with memory: `test-writer` (failing tests first, separate from implementer), `reviewer` (fresh context,
  read-only, one pass per phase), `ui-qa` (browser checks + screenshots per acceptance criterion).
- Hooks: post-edit ruff + mypy for `.py`, eslint + tsc for `.ts(x)`; stop-gate blocks completion while fast gates fail.
- `make verify` runs all gates locally in CI order.

## 13. Build phases

| Phase | Scope | Exit |
|---|---|---|
| P0 Foundation | uv workspace, kit port + scrub, Compose, config, logging, Sentry, `/health`, CI skeleton, harness | `docker compose up` serves health + blank SPA; CI green |
| P1 AI package | schema, prompt v1, parsing, alignment, providers, analyzer, starter evals | ai tests green; `make eval` runs |
| P2 Backend Stage 1 | models, migration, repositories, services, routes | integration flow test green |
| P3 Frontend Stage 1 | Write, Feedback, History | component + e2e + axe green |
| P4 Stage 2 | insights calc, endpoint, Insights screen | calc + endpoint + UI tests green |
| P5 Ship | eval tuning, README, CD, Loom outline | all gates green; README complete |

Each phase: failing tests first, small commits per step, `make verify` output shown, one reviewer pass.

## 14. Configuration

`DATABASE_URL, AI_PROVIDER (anthropic|fake), AI_MODEL, AI_EFFORT, AI_TIMEOUT_SECONDS, ANTHROPIC_API_KEY,
SUPPORTED_LANGUAGES, LOG_LEVEL, LOG_FORMAT (json|console), SENTRY_DSN, SENTRY_ENVIRONMENT, RELEASE,
LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_HOST, CORS_ORIGINS`; frontend `VITE_API_BASE_URL,
VITE_SENTRY_DSN`. `.env.example` documents all; Compose defaults to `AI_PROVIDER=fake` when no key is set.

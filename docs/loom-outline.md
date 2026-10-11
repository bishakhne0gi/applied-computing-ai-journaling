# Walkthrough outline (5–7 min)

Before recording: `docker compose up --build` with an API key configured (Claude), a terminal with the repo open,
the browser at http://localhost:8080 at 1280 px, at least three Spanish entries already analysed (Insights shows trends only from four); a second tab on the
mock build (`pnpm -C frontend build --mode mock && pnpm -C frontend preview`) for the failure state.

| Time | Segment | Show | Say (one line each) |
|---|---|---|---|
| 0:00–0:30 | Problem | README top | Learners need feedback after writing, in their own words, and a sense of progress — without being interrupted while writing. |
| 0:30–2:00 | Write → feedback | The workspace; type a Spanish entry with `[to travel]` (chip appears); ⌘/Ctrl+Enter | One screen. Saved first, analysed second; highlights in my text; panel; the bracket became `vocab_help`; "Your text / Corrected" tabs. |
| 2:00–2:30 | Failure | `/?mock=analysis-fail` on the mock build | The entry is kept, the failed analysis is a stored resource, "Retry analysis" runs it again. |
| 2:30–3:00 | Revise + history | "Revise & re-check"; pick an older entry in the sidebar | The main column swaps in place; the switcher keeps every analysis; my draft is still there when I come back. |
| 3:00–3:30 | URL as state | Copy `/?entry=…`, Back/Forward, open on a phone width | Selection, sheet and filter live in the URL; phones get sheets, not pages. |
| 3:30–4:15 | Insights | Progress card → "Open insights", choose Spanish | Errors per 100 words over time, earlier vs recent per category, recurring badge: in a sheet over the workspace. |
| 4:15–5:00 | Architecture | README diagram; import-linter contracts in `backend/pyproject.toml` | Routes → services → repositories → db, enforced by a tool; `journal_ai` is a pure package behind an `Analyzer` protocol. |
| 5:00–5:45 | AI handling + evals | `ai/journal_ai/analyzer.py`, `parsing.py`, `alignment.py`; README eval table | Structured output, defensive parsing, one retry, code-point alignment, failure codes; 36-case eval with recall, category accuracy and false positives. |
| 5:45–6:30 | Tests + harness | `make verify` tail; the `.claude/` rules and hooks | Test pyramid with counts; the repo conventions (rules, hooks) that enforce the standards. |
| 6:30–7:00 | Trade-offs | README "Deliberately left out" + "Scaling path" | Sync analysis now, a queue later via `analyses.status`; what I'd do next. |

# Deep-dive Q&A

**Why one screen instead of routes?** Every context switch was a page change; with the URL as the only state owner, the workspace keeps shareable links and Back while removing navigation.

**Why port SmoothUI by hand instead of the shadcn CLI?** One token system, no Radix/vaul/CVA, file-size and a11y rules; `motion` is the only new dependency.

**Why synchronous analysis?** One user and ~4 s calls: a queue adds Redis, a worker and polling for no visible gain. The pending row is committed before the model call (`backend/app/services/analyses.py`), so a queue only changes who calls `Analyzer.analyze`.

**Why code-point offsets?** Python indexes strings by code point, JavaScript by UTF-16 unit; accented text or emoji would shift highlights. The backend NFC-normalises and the UI slices with `Array.from(text)`, so both count the same units (`ai/journal_ai/alignment.py`, `frontend/src/features/feedback/segmentText.ts`).

**Why persist failures instead of returning 5xx?** The analysis is a resource and its outcome is data: the UI shows "Retry analysis", history shows the status, and `raw_response` + `error_code` make bad outputs debuggable. A 5xx would lose all that and look like a server bug.

**Why snapshot `input_text`?** Offsets point into the text that was analysed. After an edit, old analyses must still highlight correctly, and insights count words on what was analysed.

**Why a fixed taxonomy?** Free-form categories cannot be aggregated. Eleven categories plus `other` keep insights comparable across entries and languages; unknown values map to `other` instead of failing.

**Why deterministic insights?** Numbers and template sentences are testable at exact thresholds and cannot hallucinate progress. An LLM summary would read nicer but could not be verified.

**Why pooled rates?** Averaging per-entry rates lets a 10-word entry with one error outweigh a 200-word entry; Σ errors / Σ words weights by how much was written.

**Why only the latest succeeded analysis?** Re-checking must not double-count, and a failed re-check must not erase earlier good feedback.

**How does parsing stay robust?** Structured outputs make valid JSON the norm; `parse_analysis` still strips fences, validates the top level (else one retry with the error appended, then `invalid_output`) and validates each mistake independently, dropping and counting bad ones.

**How do evals work?** `ai/evals/dataset.json` (schema-validated by `ai/tests/test_eval_dataset.py`) → the real analyzer → word-bounded overlap per expected span → recall, category accuracy, false-positive rate on clean entries, p50 latency. `make eval` runs it; CI runs it offline.

**What does Langfuse see?** Metadata only — model, prompt version, latency, tokens, status, failure code, counts. Entry text goes only to the model provider. Off unless all three keys are set (`ai/journal_ai/langfuse_tracer.py`).

**How would you scale?** Queue on `analyses.status`, a sweeper for stale pending rows, write-time error counts for insights, `user_id` + auth for multiple users. Images are already built for GHCR.

**How do you handle prompt injection?** The entry is wrapped in `<entry>` delimiters with look-alikes stripped, the system prompt says the entry is data, and the output is schema-constrained and validated — the worst case is bad feedback, never an action.

**What are the repo conventions for?** They make standards mechanical: path-scoped rules, a stop-gate that blocks "done" while lint or types are red, post-edit lint/type checks, and a hook that keeps secrets out of tool calls.

**What would you do next?** Spaced review of recurring mistakes, drills built from past errors, more eval languages with native-speaker labels, a queue once analyses get slower, and auth.

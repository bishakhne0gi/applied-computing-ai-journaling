# Walkthrough outline (6–8 min)

Before recording: `docker compose up --build` with an API key configured (Claude), a terminal with the repo open,
the browser at http://localhost:8080 at 1280 px, at least three Spanish entries already analysed (Insights shows trends only from four); a second tab on the
mock build (`pnpm -C frontend build --mode mock && pnpm -C frontend preview`) for the failure state.

| Time | Segment | Show | Say (one line each) |
|---|---|---|---|
| 0:00–0:30 | Problem | README top | Learners need feedback after writing, in their own words, and a sense of progress, with quiet hints while they write that never interrupt (underlines, opt-in accept, 0% false positives on the eval). |
| 0:30–2:00 | Write → feedback | The workspace; type a Spanish entry with `[to travel]` (chip appears); ⌘/Ctrl+Enter | One screen. Saved first, analysed second; highlights in my text; panel; the bracket became `vocab_help`; "Your text / Corrected" tabs. Pause: «yo es» underlines; Accept from the list; Cmd/Ctrl+Z undoes it; the saved analysis is still the source of truth (20 s). |
| 2:00–2:45 | Writing assist | Caret in a sentence → Rephrase (or Alt+R); a pause at the end of the text; `market` without brackets | Three versions, changed words in indigo, the info toggletip says why; Compare; apply, then ⌘Z. A pause at the end shows grey ghost text, Tab accepts it, the Autocomplete switch turns it off. `market` without brackets gets word help. All three are live-model calls that store nothing. |
| 2:45–3:15 | Failure | `/?mock=analysis-fail` on the mock build | The entry is kept, the failed analysis is a stored resource, "Retry analysis" runs it again. |
| 3:15–3:45 | Revise + history | "Revise & re-check"; pick an older entry in the sidebar | The main column swaps in place; the switcher keeps every analysis; my draft is still there when I come back. |
| 3:45–4:15 | URL as state | Copy `/?entry=…`, Back/Forward, open on a phone width | Selection, sheet and filter live in the URL; phones get sheets, not pages. |
| 4:15–5:00 | Insights | Progress card → "Open insights", choose Spanish | The chart first, then earlier vs recent per category with arrows and correction pills, recurring badge: in a sheet over the workspace. No summary bullets: they repeated the chart. |
| 5:00–5:45 | Architecture | README diagram; import-linter contracts in `backend/pyproject.toml` | Routes → services → repositories → db, enforced by a tool; `journal_ai` is a pure package behind an `Analyzer` protocol. |
| 5:45–6:30 | AI handling + evals | `ai/journal_ai/analyzer.py`, `parsing.py`, `alignment.py`; README eval table | Structured output, defensive parsing, one retry, code-point alignment, failure codes; 42-case eval with recall, category accuracy and false positives (prompt v2: 97% / 100% / 0% on Opus 5.5, 91% / 97% / 0% on the live Haiku). |
| 6:30–7:15 | Tests + harness | `make verify` tail; the `.claude/` rules and hooks | Test pyramid with counts; the repo conventions (rules, hooks) that enforce the standards. |
| 7:15–7:45 | Trade-offs | README "Deliberately left out" + "Scaling path" | Sync analysis now, a queue later via `analyses.status`; what I'd do next. |

# Deep-dive Q&A

**Live hints interrupt writing, and the brief warned about that. Why add them?** The interruption to avoid is modal correction and stolen focus. These are quiet underlines: no pop-up opens by itself, focus never leaves the text, accept is opt-in per hint, and a switch turns them off. The real friction risk is a false underline, and the live model (`claude-haiku-5-5`, effort low) raised 0% false positives on the eval's clean entries (recall 91%, category 97%, p50 1.9 s per check, about 3.1 s to a hint with the debounce, prompt v2 on 42 cases). The fast model never writes history.

**Don't live hints deflate the insights?** Yes, and the docs say so. Accepting a hint fixes the mistake before the counted analysis runs, so insights measure what reaches submission and a learner who accepts every underline sees their measured error rate fall. It is acceptable for this slice because accept is per hint, the switch turns hints off, and the saved analysis still reflects what the learner chose to submit. The follow-up is to record accepted-hint categories (no text) and show "caught while writing" next to the rate.

**Failures are data elsewhere. Why does `/check` return 503?** Nothing is created, so there is no resource to hold the outcome, and a stale hint has no value tomorrow. 503 is the honest status, and the UI hides hints silently and keeps the last good ones.

**The brief asked for feedback after writing. Why live assist?** Hints came first and the same rule carried over to rephrase and autocomplete: nothing opens by itself, focus never leaves the text, and nothing is applied without the learner's own key press (Accept, Tab, a click), always undoable. The saved analysis is still the full feedback and the only history.

**You listed autocomplete as left out because it writes for the learner. Why add it?** It is short (at most 8 words), appears only at a pause at the end of the text, is accepted deliberately with Tab, and has its own opt-out switch that persists, separate from hints. It is on by default because a switch nobody finds is not consent, and the switch is next to the editor. Rephrase teaches through the reason on every version, so the learner reads before choosing.

**What does autocomplete cost?** One live-model call per pause, sending the whole entry: roughly 15 to 35 Haiku calls per minute of continuous typing, and a call the client cancels is still billed. Each endpoint holds at most 2 concurrent calls per process and answers 503 beyond that. The levers are the switch, a longer pause, sending only the text before the caret, and a per-client limiter.

**Why does the client compute the diff?** The model only has to return text, which is easier to validate; a word-level LCS on a sentence of at most 500 characters is instant, deterministic and unit-tested.

**Why recharts now, after "no chart library"?** The chart is animated with a tooltip, which is what the shadcn chart is built on; it ships only in the lazy insights chunk, so the writing screen and Lighthouse are untouched. The sidebar sparkline is still hand-drawn.

**Do accepted suggestions deflate insights?** Yes, the same way accepted hints do: insights measure the submitted text, so accepted versions, better words and ghost text can lower the measured error rate. Nothing from rephrase or autocomplete is stored or tracked yet; the follow-up is the same "caught while writing" count with categories and no text.

**Why one live model for all of it?** Hints, rephrase and autocomplete all need an answer in about two seconds and a near-zero false-positive rate; Haiku at low effort gives that, and one setting (`AI_LIVE_MODEL`) controls the cost. The saved analysis stays on the stronger model.

**Why one screen instead of routes?** Every context switch was a page change; with the URL as the only state owner, the workspace keeps shareable links and Back while removing navigation.

**Why port SmoothUI by hand instead of the shadcn CLI?** One token system, no Radix/vaul/CVA, file-size and a11y rules; `motion` is the only new dependency.

**Why synchronous analysis?** One user and ~4 s calls: a queue adds Redis, a worker and polling for no visible gain. The pending row is committed before the model call (`backend/app/services/analyses.py`), so a queue only changes who calls `Analyzer.analyze`.

**Why code-point offsets?** Python indexes strings by code point, JavaScript by UTF-16 unit; accented text or emoji would shift highlights. The backend NFC-normalises and the UI slices with `Array.from(text)`, so both count the same units (`ai/journal_ai/alignment.py`, `frontend/src/features/feedback/segmentText.ts`).

**Why persist failures instead of returning 5xx?** The analysis is a resource and its outcome is data: the UI shows "Retry analysis", history shows the status, and `raw_response` + `error_code` make bad outputs debuggable. A 5xx would lose all that and look like a server bug.

**Why snapshot `input_text`?** Offsets point into the text that was analysed. After an edit, old analyses must still highlight correctly, and insights count words on what was analysed.

**Why a fixed taxonomy?** Free-form categories cannot be aggregated. Eleven categories plus `other` keep insights comparable across entries and languages; unknown values map to `other` instead of failing.

**Why deterministic insights?** Numbers are testable at exact thresholds and cannot hallucinate progress; an LLM summary would read nicer but could not be verified. The UI shows the chart and table, and the template sentences only in the not-enough-data state, because the summary bullets repeated the chart.

**Why pooled rates?** Averaging per-entry rates lets a 10-word entry with one error outweigh a 200-word entry; Σ errors / Σ words weights by how much was written.

**Why only the latest succeeded analysis?** Re-checking must not double-count, and a failed re-check must not erase earlier good feedback.

**How does parsing stay robust?** Structured outputs make valid JSON the norm; `parse_analysis` still strips fences, validates the top level (else one retry with the error appended, then `invalid_output`) and validates each mistake independently, dropping and counting bad ones.

**How do evals work?** `ai/evals/dataset.json` (schema-validated by `ai/tests/test_eval_dataset.py`) → the real analyzer → word-bounded overlap per expected span → recall, category accuracy, false-positive rate on clean entries, p50 latency. `make eval` runs it; CI runs it offline.

**What does Langfuse see?** Metadata only — model, prompt version, latency, tokens, status, failure code, counts. Entry text goes only to the model provider. Off unless all three keys are set (`ai/journal_ai/langfuse_tracer.py`).

**How would you scale?** Queue on `analyses.status`, a sweeper for stale pending rows, write-time error counts for insights, `user_id` + auth for multiple users. Images are already built for GHCR.

**How do you handle prompt injection?** The entry is wrapped in `<entry>` delimiters with look-alikes stripped, the system prompt says the entry is data, and the output is schema-constrained and validated — the worst case is bad feedback, never an action.

**What are the repo conventions for?** They make standards mechanical: path-scoped rules, a stop-gate that blocks "done" while lint or types are red, post-edit lint/type checks, and a hook that keeps secrets out of tool calls.

**What would you do next?** Spaced review of recurring mistakes, drills built from past errors, more eval languages with native-speaker labels, a queue once analyses get slower, and auth.

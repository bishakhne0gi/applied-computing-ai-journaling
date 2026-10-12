# P8 — Writing assist (rephrase, better words, autocomplete, unbracketed word help) and insights polish

Date: 2026-10-12 · Status: implemented (P8; scope approved by the user, controller decisions
`.superpowers/sdd/2026-10-12-p8-writing-assist/decisions.md`, D1–D8).
Amends the main spec §2 (product decisions, "deliberately left out"), §5 (API), §6 (AI pipeline), §7 (frontend),
§9 (observability) and §14 (configuration), and P6 §7. Data model and insights rules are unchanged: nothing in
this phase is stored.

## 1. Problem

The brief lists open directions beyond corrections: style suggestions, rewritten versions, side-by-side
comparison, vocabulary improvements and autocomplete. The user asked for all of them as one "writing assist" layer
on top of P7's live hints, plus two fixes to the insights sheet (the summary bullets repeat what the chart shows; the
table reads as a spreadsheet).

## 2. Scope

| # | Feature | Where |
|---|---|---|
| 1 | **Rephrase**: three better versions of one sentence (tone label, changed words coloured, a one-line "why" per version), side-by-side compare | composer (apply, undoable) and saved entry (read-only, copy) |
| 2 | **Better words**: up to four words in that sentence with alternatives that keep the meaning, each with a nuance note | same card, second tab |
| 3 | **Autocomplete**: grey ghost text after a pause at the end of the text, accepted with Tab | composer |
| 4 | **Unbracketed word help**: English (or any other language) written without brackets is treated like `[word]` | saved analysis and live hints (prompt change, no new endpoint) |
| 5 | **Insights**: Summary section removed; the chart comes first, animated, with a tooltip | insights sheet |
| 6 | **Insights table**: category icons, up/down arrows for trends, red/green correction pills that never wrap | insights sheet; the correction pill also everywhere `Correction` renders |

Out of scope: storing rephrasings or completions, counting accepted suggestions in insights, streaming completions,
multi-sentence rewrite of a whole entry, a per-user rate limiter.

## 3. Shared rules for the new AI calls

Both new endpoints follow `/check` (P6 §7.2) exactly unless this section says otherwise.

- **Stateless.** Nothing is written to the database; nothing reaches insights.
- **Model.** The live model: `AI_LIVE_MODEL` (default `claude-haiku-5-5`), effort `low`, one attempt, SDK
  `max_retries=0`, timeout `AI_LIVE_TIMEOUT_SECONDS` (default 8 s). No new environment variables.
- **One provider, one object.** `journal_ai.WritingAssist(provider)` owns one `CompletionProvider` and exposes
  `rephrase(...)` and `complete(...)`; it never raises for provider or output problems (returns an outcome with a
  `FailureCode`), like `Analyzer.analyze`. The backend depends on `RephraserPort` / `CompleterPort` protocols in
  `app.services.writing_assist`, never on `journal_ai` internals or the SDK (import-linter, unchanged contracts).
- **Untraced.** Like live checks: autocomplete fires on every pause, and Langfuse would see only metadata anyway.
- **Concurrency.** Each endpoint has its own `asyncio.Semaphore(2)` per process (`app.state.rephrase_slots`,
  `app.state.complete_slots`), mirroring `live_slots`. A request that finds its slots full answers 503 at once
  (refusing beats queueing: a queued completion is stale on arrival). Separate slots so a background hint or ghost
  text in flight never refuses the click on Rephrase.
- **Privacy.** Entry text, the sentence, versions, vocabulary and completions are never logged, never sent to
  Sentry or Langfuse, never stored. One log line per call (§8). A crash logs the exception class name only.
- **Failure.** `503 application/problem+json`, `title: "Service Unavailable"` when the model times out, errors,
  returns unusable output, the assist object crashes, or the slots are full. `422` for invalid input.
- **Prompt injection.** Text sits inside `<entry>`, `<sentence>` or `<text>` delimiters with look-alike tags
  stripped; the system prompt says the content is data; output is schema-constrained and validated.
- **Demo mode** (`AI_PROVIDER=fake`): `FakeProvider` answers both calls deterministically (§9), so the features
  work without a key, in e2e-stack and in the Docker smoke.

## 4. API

### 4.1 `POST /api/v1/rephrase`

Request:
```json
{"language": "es",
 "text": "Ayer fui al mercado. Hoy yo es muy feliz con mi familia.",
 "start": 21,
 "end": 56}
```
- `language`: a supported code.
- `text`: the whole entry, **already** normalised the way the server normalises (`normalize_text`: CRLF/CR → LF,
  NFC, trimmed), 1–5000 code points. The server does **not** strip it (the offsets point into it): if
  `normalize_text(text) != text` the request is 422 (`"text must be normalised (NFC, LF line ends, trimmed)"`). The
  composer builds it with `serverView(value).text`; the saved view sends `analysis.input_text`, already normalised.
- `start`, `end`: Unicode **code-point** offsets into `text`, end exclusive. `0 ≤ start < end ≤ len(text)`.
  The span `text[start:end]` must not be blank, must be ≤ 500 code points and must hold ≥ 3 words (Python
  `str.split()` count); otherwise 422. The span is a sentence or a selection; the server rephrases exactly it, and
  sends the whole entry to the model only as context.

Response `200`:
```json
{"sentence": "Hoy yo es muy feliz con mi familia.",
 "versions": [
   {"text": "Hoy estoy muy feliz con mi familia.", "tone": "natural", "label": "More natural",
    "explanation": "«Estar» describes how you feel right now, so «estoy» sounds natural here."},
   {"text": "Hoy me siento muy feliz junto a mi familia.", "tone": "formal", "label": "More formal",
    "explanation": "«Me siento» and «junto a» are a little more careful, as in writing."},
   {"text": "Hoy estoy feliz con mi familia.", "tone": "simpler", "label": "Simpler",
    "explanation": "Dropping «muy» keeps the meaning with fewer words."}],
 "vocabulary": [
   {"original": "feliz", "start": 14, "end": 19,
    "alternatives": [
      {"word": "contento", "nuance": "Everyday and a little softer than «feliz»."},
      {"word": "encantado", "nuance": "Delighted; often about something that just happened."}]}]}
```
- `sentence` = `text[start:end]` exactly (the client compares it with its own text before applying).
- `versions`: 1–3 items (normally 3), distinct, none equal to `sentence` after NFC + strip, each one line (no
  newline). `tone ∈ {"natural","formal","casual","simpler"}`; `label` is 1–4 English words; `explanation` is one
  learner-facing English sentence: what changed and why.
- `vocabulary`: 0–4 items, ordered by `start`, non-overlapping. `original` is copied from `sentence`; `start`/`end`
  are code points **into `sentence`** (not into `text`), end exclusive, placed by the same whole-word rule as
  analyses (`journal_ai.alignment`); an item the server cannot place is dropped. 1–3 `alternatives` each, none equal
  to `original` (case-insensitive); `nuance` is one short English line.
- The word diff (which words of a version changed) is computed by the client; the model returns only text.

Errors: `422` (validation, above) · `503` problem+json, `detail: "Rephrasing is unavailable right now"`.

### 4.2 `POST /api/v1/complete`

Request: `{"language": "es", "text": "Hoy fui al mercado con "}`
- `text`: the text **up to the caret**, 1–5000 code points, not blank. **Not trimmed** — trailing whitespace tells
  the server whether the next word needs a leading space. The server applies NFC and LF line ends only.

Response `200`: `{"completion": "mi madre para comprar fruta."}`
- The string to insert verbatim at the caret. It may be `""` (nothing useful to add, or fewer than 3 words — then
  the model is not called).
- Post-processing in `journal_ai` (the model is asked for the same, the code enforces it): first line only; at most
  8 words (cut at the 8th); at most 120 code points; trailing whitespace removed; if `text` ends in whitespace,
  leading whitespace is removed; otherwise at most one leading space is kept (a space starts a new word; no space
  finishes the word in progress, e.g. `"Hoy fui al merc"` → `"ado con mi madre."`).
- Example without a trailing space: `{"text": "Hoy fui al mercado"}` → `{"completion": " con mi madre."}`.

Errors: `422` (unsupported language, blank, > 5000 code points) · `503` problem+json,
`detail: "Autocomplete is unavailable right now"`.

### 4.3 Offset rules (summary)

| Field | Unit | Indexes into |
|---|---|---|
| request `start`/`end` (`/rephrase`) | code points | request `text` (normalised by the client) |
| response `vocabulary[].start/end` | code points | response `sentence` |
| `/check` hints (unchanged) | code points | response `analyzed_text` |

The client converts code points to UTF-16 with `utf16Offsets`, and maps server-text positions to textarea
positions with `serverView(value).toValue` (P7).

## 5. Unbracketed word help (prompt v2)

`journal_ai` prompt `v1` → `v2` (`PROMPT_VERSION = "v2"`; one prompt serves the saved analysis and the live check,
so both get it). The `vocab_help` kind is redefined: "a word or phrase the learner wrote in English, or in any
language other than {language}, because they did not know it — in square brackets **or unbracketed** in the running
text. `original` is the bracketed text including the brackets, or the foreign words exactly as written. Do not flag
proper nouns, names, brands, or loanwords that {language} speakers use as they are (e.g. «email», «fútbol» in
Spanish, «week-end» in French)." Category stays `vocabulary` (the parser already forces it for `vocab_help`).

- Saved feedback and live hints show it like bracket help: "Word help · market → mercado". Accepting a live hint
  replaces the English words with the target word.
- Evals: new cases `es-foreign-1`, `es-foreign-2`, `fr-foreign-1` (expected `vocabulary` on the English words) and
  `es-loanword-1`, `fr-loanword-1` (names and loanwords, `expected: []`, so they count toward the false-positive
  rate). The controller runs `make eval` with the real model and records recall and FP in the plans index.
- Demo mode: `FakeProvider` gains a tiny per-language glossary for unbracketed English (`market`, `beach`,
  `happy` → es `mercado`, `playa`, `feliz`; fr `marché`, `plage`, `heureux`), mirrored in the MSW analyser.

## 6. Frontend behaviour

### 6.1 Rephrase in the composer

- **Target.** A non-empty selection (trimmed) if there is one; otherwise the sentence that contains the caret.
  Sentences come from `Intl.Segmenter(language, {granularity: "sentence"})` over the textarea value, trimmed of
  surrounding whitespace; a line break always ends a sentence. The target is eligible when it has ≥ 3 words and
  ≤ 500 code points, a language is chosen and the composer is editable.
- **Triggers.** (a) A "Rephrase" ghost button with the sparkle icon in the controls row under the editor (beside the
  switches), disabled when no eligible target, `aria-keyshortcuts="Alt+R"`; (b) **Alt/Option+R** in the textarea
  (matched on `event.code === "KeyR"` so Option's dead-key output does not matter; ignored while composing);
  (c) on pointer devices, when a selection of ≥ 3 words exists, a small floating "Rephrase" pill above the end of the
  selection (not on touch, where the native selection menu sits there).
- **Highlight.** While the card is open the target is tinted `primary-soft` in the backdrop; live-hint underlines
  inside it are hidden until the card closes.
- **Card.** Desktop (≥ 64rem): a non-modal `role="dialog"` card (`w-md`, white, `shadow-lg`) anchored under the
  target, flipping above near the viewport bottom (the P7 `placePopover` rule); focus moves to the selected tab on
  open; Esc, the close button or a click outside closes it and returns focus to the textarea with the target
  re-selected. Phones: the bottom `Sheet` titled "Rephrase" (modal, focus trapped); closing returns focus to the
  Rephrase button, not the textarea, so the on-screen keyboard does not pop up.
- **Content.** The target sentence quoted at the top in a `primary-soft` tint, then `AnimatedTabs`
  "Rephrase" | "Better words".
  - *Rephrase tab*: one row per version: the version text with changed words in `text-primary font-medium`
    (kept words plain), a tone badge, an info toggletip (`Tooltip`, content: label + explanation), and a
    "Compare" toggle (`aria-expanded`) that opens a two-column comparison under the row — "Your sentence" | the
    version label; columns stack below 40rem — where removed words are `<del>` on `neutral-soft` and added words
    `<ins>` on `primary-soft` (meaning carried by element and weight, not only colour). Clicking (or Enter on) the
    version text replaces the target in the textarea through the editing API (`applyHint`), so ⌘/Ctrl+Z undoes it;
    the card closes and a polite announcement says "Sentence replaced. Press Command or Control Z to undo."
  - *Better words tab*: one row per vocabulary item: the original word as a `primary-soft` chip, an arrow, then each
    alternative as a chip button with a nuance toggletip beside it. Clicking an alternative replaces that word in the
    textarea (undoable) and closes the card. No items → "This sentence already uses good words."
- **States.** Loading: `LoadingState` "Finding better versions…" with three skeleton rows; error (503, network):
  `ErrorState` "Rephrasing is unavailable right now." with Retry; a version list is never empty on 200.
- **Stale guard.** Before applying, the client checks that the textarea text at the target still equals
  `sentence` (via `serverView`); if not, nothing is replaced and an `InlineAlert` says "The sentence changed. Close
  this and rephrase again."
- The request is a TanStack query keyed by `(language, text, start, end)`: closing the card aborts it; reopening
  the same target is instant (cached 5 min); no automatic retry.

### 6.2 Rephrase on a saved entry

- A secondary "Rephrase a sentence" button (sparkle icon) joins the feedback actions. It opens an inline card
  section below the feedback actions (all widths; it sits in the flow, so no popover is needed) with a `Select` "Sentence"
  listing the eligible sentences of `analysis.input_text` (truncated to 60 characters with an ellipsis). The default
  is the sentence that contains the current text selection inside the entry text, else the first eligible one.
- Versions are read-only: same diff, tone badge, info toggletip and Compare toggle, plus a "Copy" button
  (`navigator.clipboard.writeText`, success toast "Copied"; on failure, danger toast "Couldn't copy"). Better words
  show alternatives as plain chips with nuance toggletips. A Close button closes the card and returns focus to the
  "Rephrase a sentence" button. Offsets need no mapping: `input_text` is the server's normalised text.

### 6.3 Autocomplete

- Requested after a **700 ms** pause when: the "Autocomplete" switch is on; the composer is editable; a language is
  chosen; no IME composition is open; the selection is collapsed **at the end of the text** (only there: a ghost
  in the middle would push the backdrop's following lines off the textarea's glyphs); the text has ≥ 3 words and is
  ≤ 5000 code points. The request sends the whole value (the caret is at its end), keyed by text; any keystroke makes
  a new key, so TanStack aborts the superseded request. 503 or a network error shows nothing (no retry, no alert).
- **Ghost.** The completion renders in the backdrop right after the last character, `text-muted`, `aria-hidden`
  like the rest of the backdrop. Only one ghost at a time.
- **Keys.** Tab (no modifiers, not composing) with a visible ghost: `preventDefault`, insert the ghost at the caret
  through the editing API (undoable), clear it. Tab without a ghost: default focus move — never trapped. Esc clears
  the ghost (and stops there: it does not also close something else). Typing that matches the ghost's next
  characters consumes them (the ghost shrinks); anything else, a caret move, blur or a selection clears it.
- **Screen readers.** A polite live region says "Suggestion: ‹text›. Press Tab to accept." once per new ghost, and
  is cleared when the ghost goes. The editor's description gains "Press Tab to accept a grey suggestion." while the
  switch is on.
- **Switch.** "Autocomplete", next to "Live hints", remembered in `localStorage` (`journal.autocomplete`; only "off"
  is stored; default on).

**Why two switches (D7).** Hints correct what the learner wrote; autocomplete writes for them. The README previously
left autocomplete out for exactly that reason, so a learner must be able to keep hints and turn ghost text off (and
screen-reader users may find a per-pause announcement noisy). Rephrase is on demand and needs no switch.

### 6.4 Insights

- The "Summary" section is removed from the report; the chart is the first thing in the sheet. `summary` stays in
  the API (the `insufficient_data` empty state still shows `summary[0]`).
- The chart is an area chart (recharts, ported shadcn-style as `components/ui/Chart`): primary stroke, a gradient
  fill from `primary` at 30% to transparent, dashed `border` gridlines, muted ticks, a hover/touch tooltip card
  (date, rate per 100 words, "n errors in m words"), and the "Latest entry" readout above it. On mount the area
  draws in (300 ms, ease-out); with reduced motion it renders final at once (`isAnimationActive=false`).
- Accessibility is unchanged: the chart wrapper is `role="img"` with the `describeRates` label, recharts' own SVG is
  `aria-hidden`, and the `sr-only` `RateTable` carries every value. recharts loads only in the lazy insights chunk;
  the eager workspace sparkline stays hand-drawn SVG.
- **Table.** Each category row starts with a Phosphor icon in a soft round badge (verb conjugation `TextAa`, verb
  tense `Clock`, gender `GenderIntersex`, number `Hash`, article `Article`, preposition `Signpost`, word order
  `ArrowsDownUp`, spelling `PencilSimple`, vocabulary `Translate`, punctuation `Quotes`, other `DotsThree`). Trend
  cell: `ArrowDown` in `success` (improving), `ArrowUp` in `danger` (getting worse), `Minus` in `muted` (steady),
  inside a soft tinted pill; the words are `sr-only` (screen readers still hear "Improving" etc.). The same trend
  pill is used in the sidebar progress card.
- **Correction pill** (`features/feedback/Correction`, used by the table, feedback panel, hint popover and list):
  the original in a tinted pill, a Phosphor `ArrowRight` (`aria-hidden`), `sr-only` "should be", the correction in a
  `success-soft` pill with `success` text. The original's tint follows the kind: error `danger-soft`/`danger`,
  suggestion `warning-soft`/`warning`, word help `mark-vocab-bg`/`mark-vocab` (an English word you didn't know is not
  an error). No line-through. Pills are `whitespace-nowrap`, truncate with an ellipsis past `max-w-48` and carry a
  `title` with the full text. On phones the table scrolls horizontally inside a focusable region
  (`role="region"`, `aria-label="Errors by category"`, `tabIndex=0`) instead of wrapping pills.

### 6.5 Icons

New dependency `@phosphor-icons/react`, imported **per icon** (`@phosphor-icons/react/dist/csr/<Name>`, which resolves to the
package's `dist/csr/<Name>.es.js`), never the barrel. The `Icon` primitive keeps its `name` API and renders the
Phosphor glyph (`weight="regular"` default, `"bold"` for trend arrows), `aria-hidden`; existing names map to
Phosphor equivalents (close `X`, check `Check`, alert `Warning`, menu `List`, chart `ChartLine`, plus `Plus`,
chevron `CaretDown`, info `Info`, refresh `ArrowClockwise`, sparkle `Sparkle`) and new names are added
(`arrowUp`, `arrowDown`, `arrowRight`, `minus`, `copy`). Category icons live in the lazy insights chunk
(`features/insights/CategoryIcon`).

## 7. Accessibility

- Every new control is a `Button`, keyboard operable, labelled, with the visible focus ring; axe passes at desktop
  and mobile in every new e2e journey.
- Rephrase card: `role="dialog"` + `aria-labelledby` (desktop), Sheet semantics (phone); tabs follow APG; version
  buttons are named by their text and described by their tone label; the info toggletips are supplementary.
- Diff meaning is carried by `<del>`/`<ins>` and font weight, not colour alone.
- Ghost text is never the only path to information: the live region announces it once; Tab is never trapped.
- Trend arrows keep `sr-only` words; category icons are `aria-hidden` (the row header names the category).
- Reduced motion: the chart draw-in, card entrance and tab indicator are instant.

## 8. Logging and privacy

| Event | Fields (never text) |
|---|---|
| `rephrase_completed` | `language`, `model`, `latency_ms`, `versions`, `vocabulary`, `error_code` |
| `rephrase_crashed` | `language`, `exception_type` |
| `completion_completed` | `language`, `model`, `latency_ms`, `words`, `error_code` |
| `completion_crashed` | `language`, `exception_type` |

Slot refusals log nothing (like `/check`). Tests assert that a secret token in the entry never appears in any log
line or Sentry call, on success, on failure and on the crash path.

## 9. Demo mode (`FakeProvider`)

`FakeProvider.complete` dispatches on the schema it is given (analysis / rephrase / completion) and reads the
language from the system prompt. Deterministic outputs, pinned by `fixtures/assist-demo.json`, which both the
backend fake tests and the MSW mock tests read:
- **Rephrase**: `natural` = the sentence with the demo correction rules applied (omitted when nothing changes);
  `formal` = a per-language opener + the corrected sentence with its first letter lower-cased (es «Sinceramente, »);
  `casual` = the corrected sentence with a per-language tag before its final punctuation (es « sin duda»). The
  first three distinct versions that differ from the sentence are returned. Explanations say "Demo mode: a scripted
  rewrite. Set ANTHROPIC_API_KEY for real versions." Vocabulary comes from a small per-language synonym table
  (es `feliz` → `contento`, `alegre`; `bonito` → `precioso`, `lindo`; fr `content` → `heureux`, `ravi`).
- **Complete**: a per-language phrase (es "y fue un buen día.", fr "et c'était une bonne journée.", de "und es war
  ein schöner Tag.", it "ed è stata una bella giornata.", pt "e foi um bom dia.") joined by §4.2's spacing rule.

The MSW mock adds `?mock=assist-unavailable` (both endpoints 503).

## 10. Failure states

| Situation | UI |
|---|---|
| `/rephrase` 503 or network error | card shows `ErrorState` with Retry; composer unaffected |
| `/rephrase` 422 (should not happen: the client gates eligibility) | same `ErrorState` text |
| Target changed before apply | `InlineAlert` in the card; nothing replaced |
| `/complete` 503, network error, `""` | no ghost, no alert |
| Clipboard write rejected (saved view) | danger toast "Couldn't copy" |
| recharts chunk fails to load | existing insights `ErrorBoundary` + Retry |
| Live model returns a foreign-word hint for a name | it is a hint like any other: Dismiss hides it (eval FP rate is the guard) |

## 11. Acceptance criteria (ui-qa, 1280×800 and 375×812, keyboard pass included)

1. Insights sheet (four or more Spanish entries): no "Summary" heading; the chart is the first block; the area draws
   in once on open; hovering a point shows a tooltip card; with reduced motion it appears without animation.
2. Insights table: every row has a category icon; trends are green down / red up / grey dash arrows with no visible
   words; "Latest example" shows a red-tinted original, an arrow and a green-tinted correction with no line-through;
   pills never wrap; on a phone the table scrolls sideways inside its region and the page does not.
3. In the composer, with the caret inside `Hoy yo es muy feliz con mi familia.`, the "Rephrase" button (and
   Alt/Option+R) opens the card anchored under the sentence (a bottom sheet on a phone); the sentence is tinted.
4. The card shows up to three versions with the changed words in indigo and a tone badge; each info button shows the
   label and the explanation; "Compare" shows the two columns (stacked on a phone) with deletions and insertions
   marked.
5. Clicking a version replaces the sentence; ⌘/Ctrl+Z restores it; the card closes and focus is back in the text.
6. "Better words" lists word chips with alternatives; clicking one replaces the word (undoable); each nuance is
   reachable by keyboard.
7. Selecting three or more words with the mouse shows the floating "Rephrase" pill above the selection; the card
   then rephrases exactly the selection.
8. `/?mock=assist-unavailable`: Rephrase shows "Rephrasing is unavailable right now." with Retry; no ghost text
   appears; writing, hints and "Get feedback" still work.
9. On a saved entry, "Rephrase a sentence" opens the inline card with a sentence picker; versions have "Copy", which
   shows the "Copied" toast; nothing in the entry changes.
10. Typing `Hoy fui al mercado con` and pausing at the end shows grey ghost text after the caret within about 2 s;
    Tab accepts it (⌘/Ctrl+Z undoes); Esc dismisses; typing the ghost's next letters consumes them; typing
    something else clears it; with no ghost, Tab moves focus to the next control.
11. The "Autocomplete" switch turns ghost text off and survives a reload; "Live hints" keeps working independently.
12. `Hoy fui al market con mi madre.` (no brackets) gets a dotted word-help underline on «market»; the hint reads
    "Word help" with market → mercado; accepting replaces it; `Hoy vi a Michael en el parque.` gets no hint on the
    name.
13. Every journey passes axe at both sizes; no console errors outside `?mock=error`/`?mock=assist-unavailable`; no
    horizontal page scroll at 375 px; screenshots under `prefers-color-scheme: dark` still show the light theme.

## 12. Gates

Unchanged bars: `make verify` (ALL GATES GREEN) at the end of every task — backend coverage ≥ 85%, Vitest band
65–85%, Playwright + axe, Lighthouse desktop 100 / mobile ≥ 90, ESLint size limits, mypy strict, import-linter,
fallow. `make e2e-stack` gains three journeys (rephrase, autocomplete, unbracketed word help) on the demo provider.
The controller runs the real-model eval (`make eval` with `AI_MODEL=claude-haiku-5-5 AI_EFFORT=low`, plus the
default model) after the prompt change and a curl latency check of `/rephrase` and `/complete`.

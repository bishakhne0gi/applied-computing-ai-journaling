# P6 — Single-screen workspace and visual redesign

Date: 2026-10-11 · Status: approved by the user ("one SPA screen, no friction; SmoothUI components; Stripe-like look")
Amends the main spec §5 (frontend) only. API, data model, AI and insights rules are unchanged.

## 1. Problem

The app is already a single-page application (one document, client routing), but it behaves like a multi-page site:
Write, History, Entry detail and Insights are separate screens. Reviewing a past entry or checking progress means
leaving the editor, then finding your way back. The brief asks for low friction; context switches are friction.

## 2. Decision: one workspace screen

Everything happens on `/`. Nothing navigates away.

```
┌ header: Journal · language status · [Insights] ──────────────────────────────┐
├ sidebar (20rem) ─────┬ main (max 44rem, centred) ────────────────────────────┤
│ [+ New entry]        │ Composer: language, text, live counts, Get feedback   │
│ [All languages ▾]    │   → feedback inline below (highlights, panel, notes)  │
│ Today                │   → Revise & re-check / New entry                     │
│  • Hoy tengo…  ●2    │ or, when an entry is selected:                        │
│ Yesterday            │   EntryHeader + analysis switcher + feedback/revise   │
│  • J'ai mangé…       │                                                       │
│ [Load more]          │                                                       │
│ ── Progress ──       │                                                       │
│ errors/100w ▁▃▂ ↓    │                                                       │
│ [Open insights]      │                                                       │
└──────────────────────┴───────────────────────────────────────────────────────┘
Insights: right-hand sheet (36rem) over the workspace; Esc / scrim / close button dismiss it, focus returns.
```

- **URL is the state** (shareable, Back works): `/?entry=<uuid>` selects an entry, `/?insights=1` opens the sheet,
  `?language=<code>` filters the sidebar and insights together. One owner: the search params. No duplicated state.
- **Old routes redirect** so links and tests keep meaning: `/entries` → `/`, `/entries/:id` → `/?entry=:id`,
  `/insights` → `/?insights=1` (query params preserved). Unknown paths keep the not-found state.
- **Selecting an entry** swaps the main column in place (no full re-render of the sidebar); the selected row is
  `aria-current="true"`. "New entry" clears `entry` and focuses the composer. The draft in progress is kept
  (existing `useDraft`) when the user peeks at an old entry and comes back.
- **Sidebar progress card**: mini sparkline of the last ≤10 rates + overall trend word, from the existing insights
  query (no new endpoint). Below 4 entries it shows "n more entries to see trends".
- **Mobile (< 1024px)**: sidebar collapses into a left sheet opened from a header "Entries" button; insights is a
  bottom sheet (90vh). Main column is full width. No horizontal scroll at 375px.
- **Keyboard**: `⌘/Ctrl+Enter` submits (unchanged). Sheets trap focus, restore focus
  to the opener, close on Esc. Route-change focus rule becomes: selecting an entry focuses its heading; opening the
  sheet focuses its heading.

## 3. Visual language (DESIGN.md)

Stripe-inspired product-dashboard look, written up in `DESIGN.md` at the repo root (our own adaptation, not a copy):
indigo primary `#533afd` (pressed `#2e2b8c`), ink `#0d253d`, secondary ink `#273951`, muted `#64748d`, canvas
`#ffffff`, soft canvas `#f6f9fc`, hairline `#e3e8ee`, input border `#a8c3de`; blue-tinted shadows
(`rgb(0 55 112 / 8%)`); radii 6 / 8 / 12px, pill buttons; system font stack with `font-feature-settings: "ss01"`
and tabular numerals on numbers; light (300) display headings with negative tracking, 400 for controls;
8px grid; one filled primary action per region; a subtle gradient band behind the header only.
Mistake colours stay semantic (error / suggestion / vocab) and must keep WCAG AA contrast. Light only, like Stripe;
dark mode is out of scope. All raw values live in `src/styles/tokens.css` `@theme`; components use roles only.

## 4. Components (SmoothUI, MIT)

Ported by hand from the SmoothUI registry into `src/components/ui/` and adapted to our tokens, `cn`, file-size and
a11y rules (not installed with the shadcn CLI — we have no `components.json` and keep one token system):
`AnimatedTabs` (corrected/original toggle, sidebar language chips if useful), `Sheet` (the SmoothUI drawer motion on our own
focus-trapped panel; SmoothUI's drawer wraps vaul, which we don't add), `Skeleton` (loading rows / feedback placeholder), `Toast`
(saved / feedback ready / failed, `role="status"`), `Tooltip` (category explanations on legend chips). Each keeps the
SmoothUI attribution line in the file header comment (licence requirement).

New dependency: `motion` (SmoothUI's animation layer). Used through `LazyMotion` + `domAnimation` and `m.*` to keep the
bundle small; every animation honours `useReducedMotion`. No `lucide-react`, Radix or CVA — inline SVG and our
existing `Button` variants instead.

## 5. Gates (unchanged bars)

Vitest coverage band 65–85% per file rule as today; Playwright + axe at desktop and mobile; Lighthouse desktop 100 /
mobile perf ≥ 90; ESLint size limits; fallow. The e2e suites are rewritten for the workspace (same journeys:
write → feedback → revise; failure + retry; history filter, load more, open entry, switch analysis; insights
summary/chart/table, empty, error) and the full-stack smoke keeps its 6 journeys. ui-qa re-checks every criterion at
1280×800 and 375×812 with screenshots `docs/qa/p6-*.png`.

## 6. Out of scope

Command palette, drag-resizable sidebar, entry delete, offline mode, theme toggle and dark mode (light only, like Stripe).

## 7. Writing assist (user request, same day)

Two more friction cuts, asked for by the user after the workspace design:

### 7.1 English words render as code chips while typing (P6)
`[word]` fallbacks show as inline code chips inside the editor as soon as the closing bracket is typed.
Implementation: the composer stays a native `<textarea>` (keeps IME, undo, spellcheck, screen-reader support) with a
**mirrored backdrop layer** behind it: same font, size, padding and wrapping; the textarea text is transparent with a
visible caret, the backdrop renders the styled text. Chips use background tint + rounded `box-shadow` spread only (no
padding, no font change), so glyph positions never drift. The backdrop scrolls with the textarea and is
`aria-hidden`; the accessible description already explains the bracket fallback.

### 7.2 Live hints with one-click accept (P7)
Amends main spec §2 "Feedback timing: post-writing only". New rule: **quiet live hints while writing, full saved
feedback on submit.**
- After the writer pauses (1.2 s debounce) and the text has ≥ 3 words, the client calls `POST /api/v1/check`
  `{text, language}`. The server runs the same analyzer with a fast model (`AI_LIVE_MODEL`, default
  `claude-haiku-5-5`, effort low) and returns the mistakes with offsets. **Nothing is stored**; live hints never count
  toward insights (only submitted analyses do). Stale requests are aborted; a newer response always wins.
  Offsets are Unicode code points (end exclusive) into the response's `analyzed_text` (NFC, trimmed), not into the
  request text; the client maps them to its own string units and re-anchors by `original`. The server also returns
  no hints, without calling the model, for fewer than 3 words, and answers 503 at once when 2 checks are already running.
- Hints appear only as underlines in the backdrop layer (error / suggestion / vocab colours, same as feedback). No
  pop-ups, no interruptions. Clicking an underline (or choosing it from the hint list) opens a small popover:
  correction, one-line explanation, **Accept** (Enter) and **Dismiss** (Esc). Accept replaces the span through the
  textarea's editing API so ⌘/Ctrl+Z undoes it; `[word]` vocab hints replace the bracketed English with the target word.
- While the user keeps typing, existing hints re-anchor by finding their `original` text near the old offset; hints
  that no longer match are dropped. Dismissed hints stay dismissed for that text.
- Accessibility: a "n hints" button under the editor (count announced politely, throttled) opens the same hints as a
  list, keyboard-operable, Accept/Dismiss per item. Underlines are decorative; the list is the accessible path.
- Control: a "Live hints" switch in the composer (remembered locally, default on). Demo mode (`AI_PROVIDER=fake`)
  serves scripted hints so the feature works without a key.
- Guard rails: same 5000-code-point limit and text privacy rules (never logged, never sent to Sentry or Langfuse);
  `/check` returns 503 problem+json when the live model is unavailable and the UI silently hides hints.
- Defence for the deep-dive: the original "post-writing only" choice was about interruption; quiet underlines with
  opt-in accept keep flow, and the paid full analysis stays the single source of truth for history and insights.

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
Light only, like Stripe; dark mode is out of scope (`color-scheme: light`, so native controls stay light too).

| Role | Value | Use |
|---|---|---|
| `bg` / `surface` | `#ffffff` / `#f6f9fc` | main canvas / sidebar and soft panels, read-only fields |
| `border` / `border-input` | `#e3e8ee` / `#7a90a8` | hairlines / control boundaries (≥3:1) |
| `fg` / `fg-secondary` / `muted` | `#0d253d` / `#273951` / `#61718a` | ink / labels, meta / hints |
| `primary` / `primary-pressed` / `primary-soft` / `primary-disabled` | `#533afd` / `#2e2b8c` / `#eeebff` / `#b3a9ff` | actions, links, focus / hover / selected rows, chips / disabled primary (light indigo, never grey) |
| `danger` / `success` / `warning` (+ `-soft`) | `#c0123c` / `#0b7a3b` / `#9a5700` (tints `#fdeef1` / `#e6f5ec` / `#fff4e0`) | status text; badges are soft tinted pills |
| `neutral-soft` | `#ebeef1` | neutral badge tint |
| `mark-error` / `-suggestion` / `-vocab` (+ `-bg`) | `#c0123c` / `#9a5700` / `#7a35c9` | feedback marks; kind also shown by underline style |
| `band` / `band-violet` / `band-pink` | `#f1efff` / `#f6efff` / `#fff0f6` | the decorative indigo → violet → pink band behind the header only |

Every text pair is ≥4.5:1 and every control boundary ≥3:1; `tokens.contrast.test.ts` fails the build if a value
drifts (or if a dark palette comes back).

## Type
System stack (`-apple-system, Segoe UI, Roboto…`) with `font-feature-settings: "ss01"`. Display headings light (300)
with tight tracking (`text-3xl font-light tracking-tight`); section headings step down by size and colour, not weight
(h2 `text-lg font-medium text-fg-secondary`, h3 `text-base font-medium`); controls and labels 400–500; numbers
`tabular-nums`.

## Space, layout, shape
8px grid (Tailwind's 0.25rem scale, even steps). Sticky full-width header (white with the band, hairline below), then a sticky sidebar `21rem` on `surface` with a hairline right edge and its own scroll + white main column `≤56rem` aligned to the sidebar edge (not centred, so it never floats), running text inside capped at `max-w-prose`;
insights sheet `36rem` from the right (bottom sheet on phones). Radii 6 / 8 / 12px (`rounded-sm|md|lg`); actions are
pills (`rounded-full`). Shadows: `sm` resting cards and inputs, `md` popovers, `lg` sheets and toasts.

## Components
- **Buttons:** primary = filled indigo pill; secondary = white pill with input-border outline, indigo on hover;
  ghost = text pill; icon = 44px round target. Disabled = 60% opacity + not-allowed cursor; the primary instead turns `primary-disabled` (lighter indigo).
- **Inputs:** white, `border-input`, `rounded-md` (selects) / `rounded-lg` (editor). Selects are custom listboxes (white card, hairline, `shadow-md`, soft indigo active row, indigo check on the selected one), never the OS menu.
- **Focus:** keyboard only (`:focus-visible`): a ring with a 2px white gap, a 2px indigo ring and a soft glow (visible on solid indigo buttons too); never on headings or panels that receive focus programmatically.
- **Cards:** white, hairline border, `shadow-sm`, `rounded-lg`; soft cards (`surface`) for secondary panels.
- **Badges:** soft tinted pills (`danger-soft` etc.), tone colour on the text, no border.
- **Correction pill:** the original in a tinted pill (red for an error, amber for a suggestion, purple for word help), an arrow, the correction in a green pill; no strikethrough, never wraps (long text truncates, `title` keeps it).
- **Trend:** an arrow in a tinted pill (down green = improving, up red = getting worse, minus grey = steady); the word is screen-reader only.
- **Sheets:** white panel, hairline edge, `shadow-lg`, scrim `fg` at 40%; slide with a short spring.
- **Tabs:** segmented pill; a white indicator slides under the selected tab.
- **Toasts:** bottom right (bottom centre on phones), white card with a tone stripe and icon.
- **Tooltips:** ink background, white text, small; on focus and hover, Esc closes. A `card` tip (the feedback legend) is a wider white card with `shadow-lg`, opening below its trigger.
- **Skeletons:** `border`-coloured pulsing blocks in the shape of what is loading.
- **Editor chips:** `[word]` gets a `primary-soft` tint with a spread-only shadow — no padding, so the text never moves.
- **Live hints:** an underline by kind; a hint on a chip keeps the tint. A case-only correction is drawn in the suggestion style, never as an error. Dismiss hides every occurrence of that exact hint (same words, same correction) until the composer starts a new entry.
- **Hint popover:** a white `Card` with `shadow-lg` under the word, flipping above near the bottom of the viewport. Passive: focus stays in the text, and typing, moving the caret or Esc closes it. Accept is the primary button, Dismiss a ghost button.
- **Hint list:** under the editor, an "n hints" disclosure with a chevron opens one small card per hint with the same Accept and Dismiss. It is the keyboard and screen-reader path.
- **Switch:** the "Live hints" toggle sits in a quiet row under the editor (a small track with a knob; the row is always present, so nothing shifts when hints appear).
- **Ghost text:** autocomplete in `muted` right after the caret, only at the end of the text; Tab accepts, Esc dismisses; an "Autocomplete" switch sits beside "Live hints".
- **Rephrase card:** anchored white card, `shadow-lg`, the quoted sentence on `primary-soft`, changed words indigo, compare columns with `del` on `neutral-soft` and `ins` on `primary-soft`; a bottom sheet on phones; a floating pill on pointer selection.

## Do / Don't
- Do use roles (`text-muted`), never raw colours; add a token when a value is missing.
- Do keep one filled button per region; use secondary or ghost for the rest.
- Do encode meaning twice (colour + underline style, colour + word).
- Don't animate layout or anything over 300ms; don't animate when reduced motion is on.
- Don't use shadows for separation inside a card — use spacing or a hairline.
- Don't put text on `band`, `scrim` or `primary-soft` without checking the table above.

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

# Design system

Three layers. Always use the lowest layer that already solves the problem.

## 1. Tokens (`@theme` in `src/styles/tokens.css`) → Tailwind utilities
| Group | Token | Utility |
|---|---|---|
| Color roles | `--color-bg, surface, border, fg, muted, primary, primary-contrast, danger, success, warning, scrim` (modal backdrop) | `bg-surface`, `text-muted`, `border-border`, `bg-primary text-primary-contrast` |
| Feedback marks | `--color-mark-error`, `mark-suggestion`, `mark-vocab` (+ `-bg` tints) | `bg-mark-error-bg decoration-mark-error` — kind is shown by colour **and** underline style (error wavy, suggestion dashed, word help dotted) |
| Space / type | Tailwind default rem scale | `p-4`, `gap-3`, `text-sm`, `font-bold` |
| Shape | `--radius-sm, md, full`, `--shadow-sm, md` | `rounded-md`, `shadow-sm` |
| Layers | `--z-index-dropdown, sticky, overlay, toast` | `z-overlay` — never `z-10` |
| Layout | `--container-content`, `--font-sans` | `max-w-content`, `font-sans` |

Mark contrast (computed): text `fg` on each tint ≥12.6:1; underline colour on its tint ≥5.9:1 (light) / ≥5.9:1 (dark) — above the 4.5:1 text and 3:1 non-text bars.

Tailwind's default palette, radius and shadow scales are wiped — only these roles exist.
Dark mode is handled by tokens (`prefers-color-scheme`) — no `dark:` classes.
Adding a token: add inside `@theme` in `tokens.css` (+ dark value if a color), add a row here, then use its utility.

## 2. Primitives (`src/components/ui/`)
Built on demand, the first time a feature needs one. Each primitive: typed props extending the native
element's props, `ref` as a plain prop (React 19), Tailwind token utilities merged with `cn()`, co-located test.

| Primitive | Variants | Notes |
|---|---|---|
| `TextLink` | — | React Router `Link` in the primary role, underlined; `className` merges last |
| `Button` | `primary`, `secondary` (default), `ghost`, `inline` (highlights inside text) | the only raw `<button>`; `type="button"` by default; `min-h-11` touch target except `inline`; pointer / not-allowed cursor |
| `Badge` | `tone`: `neutral` (default), `danger`, `success`, `warning` | status and count chips on `bg-surface` (all tones ≥4.7:1) |
| `ErrorState` | — | `role="alert"` message + retry `Button`; `retryLabel`, `retrying` |
| `InlineAlert` | — | `role="alert"` one-line danger text for a failed action next to its control; use `ErrorState` when the user must retry from the message |
| `Select` | — | native `<select>`, `min-h-11`, pointer cursor |
| `Textarea` | — | native `<textarea>`, `min-h-48`, `read-only:` surface tint |
| `Field` | — | label + control; owns the spacing between them |
| `LoadingState` | — | `role="status"` + `aria-busy`, muted label in place of content |
| `EmptyState` | — | dashed box: title + the next useful action as `children` |

## 3. Composition
Features compose primitives. Prefer compound components (`<Tabs><Tabs.List/><Tabs.Panel/></Tabs>`) and
`children` over boolean props (`isCompact`, `hasIcon`, …). A new variant is a prop value, not a new component.

Charts are plain SVG (no chart library): colour-role utilities `stroke-primary`, `fill-primary`, `stroke-border`,
`fill-none`, widths `stroke-1`/`stroke-2`, `vectorEffect="non-scaling-stroke"` on lines. The `<svg>` is
`role="img"` with an `aria-label` that states the numbers in words, and an `sr-only` table carries every value.

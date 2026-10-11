# Design system

Three layers. Always use the lowest layer that already solves the problem.

## 1. Tokens (`@theme` in `src/styles/tokens.css`) → Tailwind utilities
| Group | Token | Utility |
|---|---|---|
| Color roles | `--color-bg, surface, border, border-input, fg, fg-secondary, muted, primary, primary-pressed, primary-soft, primary-contrast, danger, success, warning, scrim, band` | `bg-surface`, `text-fg-secondary`, `border-border-input`, `bg-primary hover:bg-primary-pressed`, `bg-linear-to-b from-band to-bg` |
| Feedback marks | `--color-mark-error`, `mark-suggestion`, `mark-vocab` (+ `-bg` tints) | `bg-mark-error-bg decoration-mark-error` — kind is shown by colour **and** underline style (error wavy, suggestion dashed, word help dotted) |
| Space / type | Tailwind default rem scale | `p-4`, `gap-3`, `text-sm`, `font-bold` |
| Shape | `--radius-sm, md, lg, full`, `--shadow-sm, md, lg, chip` | `rounded-lg`, `shadow-lg`, `shadow-chip` |
| Layers | `--z-index-dropdown, sticky, overlay, toast` | `z-overlay` — never `z-10` |
| Layout | `--container-content` (80rem), `sidebar` (20rem), `main` (44rem), `sheet` (36rem), `--font-sans` | `max-w-content`, `w-sidebar`, `max-w-main`, `max-w-sheet` |

Mark contrast (computed, pinned by src/styles/tokens.contrast.test.ts): text fg on each tint ≥12.7:1; mark colour on its tint ≥5.1:1 light / ≥6.6:1 dark. Visual intent and the full table: /DESIGN.md.

Tailwind's default palette, radius and shadow scales are wiped — only these roles exist.
Dark mode is handled by tokens (`prefers-color-scheme`) — no `dark:` classes.
Adding a token: add inside `@theme` in `tokens.css` (+ dark value if a color), add a row here, then use its utility.

## 2. Primitives (`src/components/ui/`)
Built on demand, the first time a feature needs one. Each primitive: typed props extending the native
element's props, `ref` as a plain prop (React 19), Tailwind token utilities merged with `cn()`, co-located test.

| Primitive | Variants | Notes |
|---|---|---|
| `TextLink` | — | React Router `Link` in the primary role, underlined; `className` merges last |
| `Button` | `primary`, `secondary` (default), `ghost`, `icon` (44px round, needs `aria-label`), `inline` (highlights inside text) | pills (`rounded-full`) except `icon`/`inline`; the only raw `<button>`; `type="button"` by default; `min-h-11` touch target except `inline`; pointer / not-allowed cursor |
| `Badge` | `tone`: `neutral` (default), `danger`, `success`, `warning` | status and count chips on `bg-surface` (all tones ≥4.7:1) |
| `ErrorState` | — | `role="alert"` message + retry `Button`; `retryLabel`, `retrying` |
| `InlineAlert` | — | `role="alert"` one-line danger text for a failed action next to its control; use `ErrorState` when the user must retry from the message |
| `Select` | — | native `<select>`, `min-h-11`, pointer cursor |
| `Textarea` | — | native `<textarea>`, `min-h-48`, `read-only:` surface tint |
| `Field` | — | label + control; owns the spacing between them |
| `LoadingState` | — | `role="status"` + `aria-busy`; muted label, or skeleton `children` with the label `sr-only` |
| `Button` `plain` | — | unstyled trigger (focus ring and pointer cursor only) used by `Tooltip` |
| `Button` `tab` | — | used by `AnimatedTabs`; text turns `fg` when `aria-selected` |
| `AnimatedTabs` | 2–4 tabs | controlled segmented tabs (SmoothUI, MIT); arrows/Home/End; only the selected tab is tabbable and has `aria-controls`; pair with `role="tabpanel"` using `tabId`/`panelId` |
| `Skeleton` | — | `aria-hidden` pulsing block; put skeletons inside `LoadingState` so the label stays for screen readers |
| `Toast` | `tone`: `success`, `danger`, `neutral` | `useToast().show({ message, tone })`; `role="status"`, dismiss button, 5s, max 3 (SmoothUI, MIT) |
| `Tooltip` | `align`: `start`, `center` (default), `end` | toggletip: children sit in a real `Button` (`plain` variant); hint shows on hover, focus and click (click toggles), `aria-describedby`, Esc/blur/mouse leave hide (SmoothUI, MIT); for supplementary text only; the trigger is a button, so children must be phrasing content (no block elements or nested interactives) |
| `EmptyState` | — | dashed box: title + the next useful action as `children` |
| `Card` | `as`: `div` (default), `section` | hairline card, `shadow-sm`; override padding/background with `className` |
| `PageHeading` | — | `h1`, light 300, `tabIndex -1`, takes `ref` so the workspace can focus it |
| `Icon` | `name`: `close`, `check`, `alert`, `menu`, `chart`, `plus` | inline 24px stroke SVG, `aria-hidden`; the control around it carries the name |
| `Sheet` | `side`: `left`, `right`, `bottom` | modal dialog in a portal (SmoothUI drawer motion, MIT): heading focused on open, Esc/scrim/Close dismiss, Tab trapped, focus restored unless the user moved on, page scroll locked |

## 3. Composition
Features compose primitives. Prefer compound components (`<Tabs><Tabs.List/><Tabs.Panel/></Tabs>`) and
`children` over boolean props (`isCompact`, `hasIcon`, …). A new variant is a prop value, not a new component.

Motion: only `m.*` from `motion/react` (LazyMotion is strict); every animated element skips offsets and uses `{ duration: 0 }` when `useReducedMotion()` is true. Springs: `{ type: 'spring', bounce: 0–0.1, duration: 0.25–0.3 }`.

Charts are plain SVG (no chart library): colour-role utilities `stroke-primary`, `fill-primary`, `stroke-border`,
`fill-none`, widths `stroke-1`/`stroke-2`, `vectorEffect="non-scaling-stroke"` on lines. The `<svg>` is
`role="img"` with an `aria-label` that states the numbers in words, and an `sr-only` table carries every value.

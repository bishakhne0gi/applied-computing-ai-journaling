# Design system

Three layers. Always use the lowest layer that already solves the problem.

## 1. Tokens (`@theme` in `src/styles/tokens.css`) → Tailwind utilities
| Group | Token | Utility |
|---|---|---|
| Color roles | `--color-bg, surface, border, fg, muted, primary, primary-contrast, danger, success, warning, scrim` (modal backdrop) | `bg-surface`, `text-muted`, `border-border`, `bg-primary text-primary-contrast` |
| Space / type | Tailwind default rem scale | `p-4`, `gap-3`, `text-sm`, `font-bold` |
| Shape | `--radius-sm, md, full`, `--shadow-sm, md` | `rounded-md`, `shadow-sm` |
| Layers | `--z-index-dropdown, sticky, overlay, toast` | `z-overlay` — never `z-10` |
| Layout | `--container-content`, `--font-sans` | `max-w-content`, `font-sans` |

Tailwind's default palette, radius and shadow scales are wiped — only these roles exist.
Dark mode is handled by tokens (`prefers-color-scheme`) — no `dark:` classes.
Adding a token: add inside `@theme` in `tokens.css` (+ dark value if a color), add a row here, then use its utility.

## 2. Primitives (`src/components/ui/`)
Built on demand, the first time a feature needs one. Each primitive: typed props extending the native
element's props, `ref` as a plain prop (React 19), Tailwind token utilities merged with `cn()`, co-located test.

| Primitive | Variants | Notes |
|---|---|---|
| _(empty — filled as primitives are created; list them here)_ | | |

## 3. Composition
Features compose primitives. Prefer compound components (`<Tabs><Tabs.List/><Tabs.Panel/></Tabs>`) and
`children` over boolean props (`isCompact`, `hasIcon`, …). A new variant is a prop value, not a new component.

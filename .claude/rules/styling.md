---
paths:
  - "frontend/src/**/*.tsx"
  - "frontend/src/**/*.css"
---
# Styling rules (Tailwind v4, semantic tokens only)
- Style with Tailwind utilities in `className`; conditional/merged classes via `cn()` from `@/utils/utils`.
- Only semantic tokens exist: `bg-surface`, `text-fg`, `text-muted`, `border-border`, `bg-primary`, `text-danger`…
  Palette classes (`bg-blue-600`) don't exist; arbitrary values (`p-[13px]`, `text-[#111]`) and `z-10` fail lint.
- Spacing/type use Tailwind's rem scale (`p-4`, `gap-3`, `text-sm`). Layers: `z-dropdown|sticky|overlay|toast`.
- Missing value? Add it to `@theme` in `frontend/src/styles/tokens.css` + a row in `frontend/DESIGN.md`, then use the utility.
- No `dark:` variants — dark mode lives in tokens. No `@apply` in components; extract a primitive instead.
- Mobile-first: base classes for 375px, `md:`/`lg:` for larger. State via ARIA variants: `aria-selected:`, `aria-disabled:`.
- Buttons: always the `<Button>` primitive — raw `<button>` fails lint (`no-restricted-syntax`). It owns `cursor-pointer`
  (`cursor-not-allowed` when disabled/`aria-disabled`); Tailwind v4 preflight resets buttons to `cursor: default`.
  e2e specs call `expectButtonsShowPointer(page)`.
- CSS files only in `frontend/src/styles/`; import the token file as `@import './tokens.css';` (never `url()`).

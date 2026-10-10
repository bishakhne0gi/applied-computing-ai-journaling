---
paths:
  - "frontend/src/components/**"
  - "frontend/src/features/**/components/**"
---
# Component rules
- Props interface first, exported, named `<Component>Props`. Extend native props for primitives.
- `components/` = pure library (props in, callbacks out). Features compose them and call hooks for data.
- Multi-page apps (only if the phase plan adds routing): `pnpm -C frontend add react-router@8.4.0`, thin `pages/<Name>Page.tsx`, routes in `App.tsx`.
- Render all four states: loading (skeleton or `aria-busy`), empty (message + next action), error (message + retry), ready.
- Semantic HTML first (`button`, `ul/li`, `nav`, `h1–h3`); ARIA only when HTML can't express it.
- Every control has an accessible name; icon-only buttons get `aria-label`. Live updates → `aria-live="polite"`.
- Keyboard: everything clickable is focusable and operable with Enter/Space; arrow keys inside composite widgets.
- Composition over configuration: `children` / compound components instead of boolean props.
- ≤200 lines per file, ≤60 per function. Split by responsibility when close.

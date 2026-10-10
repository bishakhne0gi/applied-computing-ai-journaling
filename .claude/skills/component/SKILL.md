---
name: component
description: Checklist for building a feature component — interface-first props, four UI states, accessibility, responsive, size limits. Use whenever creating or substantially changing a component under frontend/src/features.
---
# Building a feature component

## 1. Interface first
Write and export `<Name>Props` before JSX. Data in, callbacks out:
`items`, `status`, `error`, `onRetry`, `onSelect(id)`. No fetching inside; a hook (`use<Feature>`) connects
the component to local state or a query hook (never `utils/client` directly).

## 2. Four states — all rendered, all tested
| State | Render | a11y |
|---|---|---|
| loading | skeleton or spinner in place of content | container `aria-busy="true"` |
| empty | message + the next useful action | plain text, not only an icon |
| error | human message + Retry button | `role="alert"` |
| ready | content | lists as `ul/li`, headings in order |

## 3. Accessibility
- Native elements first (`button`, `a`, `input`, `label`, `fieldset`).
- Every control has a name; icon-only → `aria-label`. Toggle → `aria-pressed`; tabs → `role=tablist/tab/tabpanel` + `aria-selected`.
- Count or status changes announced with an `aria-live="polite"` region.
- Keyboard: Tab reaches it, Enter/Space activates, Escape closes overlays, focus returns to the trigger.

## 4. Responsive
Mobile-first (base classes = 375px; `md:`/`lg:` add larger layouts); verify at 375px and 1280px. Touch targets ≥ 2.75rem. No horizontal scroll.

## 5. Limits
≤200 lines/file, ≤60/function, complexity ≤10. Close to a limit → split into subcomponents
or move logic into a selector/hook.

## 6. Done when
Props exported · 4 states tested (RTL) · axe clean in e2e · reviewer has no BLOCKING findings.

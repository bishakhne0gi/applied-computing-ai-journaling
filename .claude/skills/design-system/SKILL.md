---
name: design-system
description: How to style and build UI with the token → primitive → composition system (Tailwind v4, semantic tokens). Use when creating or changing any visual element, adding a token, or creating a primitive in frontend/src/components/ui.
---
# Design system

Before writing components: invoke `vercel-react-best-practices` and `vercel-composition-patterns` skills.
No Figma? `npx getdesign@0.6.25 list`, pick a slug that fits the product (e.g. `stripe`, `wise`, `linear.app`),
`npx getdesign@0.6.25 add <slug>` then move it to `docs/design-reference.md` (frontend/DESIGN.md is our token catalogue)
and map its colours/type/radius into the `@theme` roles — gates still apply.

Order of reuse: existing primitive → new variant (prop value) → new primitive → feature-local component.

## Tokens
- Read `frontend/DESIGN.md` for the catalogue. Values only via token utilities (`bg-surface`, `rounded-md`);
  spacing/type from Tailwind's rem scale (`p-4`, `text-sm`).
- New value needed → add a token inside `@theme` in `frontend/src/styles/tokens.css` (+ dark value for colors), add a row in `frontend/DESIGN.md`.
- Color by role (`bg-danger`), never by hue. Text roles must keep ≥4.5:1 contrast.

## Creating a primitive (`frontend/src/components/ui/<Name>/`)
Files: `<Name>.tsx`, `<Name>.test.tsx`, `index.ts`. Import primitives only via the folder index.
```tsx
import type { ComponentProps } from 'react'
import { cn } from '@/utils/utils'

const variants = {
  primary: 'bg-primary text-primary-contrast',
  secondary: 'border border-border bg-surface text-fg',
  ghost: 'text-fg hover:bg-surface',
} as const

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: keyof typeof variants
}

export function Button({ variant = 'secondary', className, ...rest }: ButtonProps) {
  return <button type="button" className={cn('rounded-md px-4 py-2 text-sm', variants[variant], className)} {...rest} />
}
```
- `ref` is a plain prop in React 19 (it arrives via `ComponentProps`). No `forwardRef`.
- Variants = one prop keyed into a class map. No boolean flags that combine into impossible states.
- `className` last in `cn()` so callers can override. Test: role/name, variant applies, native props pass through.
- Add it to the Primitives table in `frontend/DESIGN.md`.

## Composition
- Compound components for multi-part widgets (`Tabs`, `Menu`, `List`): parent owns state via context,
  children (`Tabs.Tab`, `Tabs.Panel`) read it. Export as `Object.assign(Root, { Tab, Panel })`.
- Slots through `children`, not `renderX` booleans. Layout (`Stack`, `Cluster`) primitives own spacing
  so features never set margins between siblings.

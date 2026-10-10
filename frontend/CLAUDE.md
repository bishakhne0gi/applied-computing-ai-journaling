# Frontend rules

Vite + React 19 + TypeScript (strict) + Tailwind v4. pnpm only. Run commands from `frontend/` (or `pnpm -C frontend …`).

## Commands
- `pnpm dev` (http://localhost:5173) · `pnpm test` · `pnpm e2e` · `pnpm lint` · `pnpm typecheck`
- `pnpm verify` — full gate in pyramid order (types → lint → dupes/dead code → unit + coverage band → e2e + axe → Lighthouse), stops at the first failure. `pnpm verify:fast` — types + lint.

## Structural constraints (enforced by tools — do not work around them)
1. **Single source of truth** — one owner per piece of state (local, zustand or query cache — never two); derive counts/filters/sorts, never store them twice. No copy-pasted markup or styles: extract a primitive. (fallow, reviewer)
2. **Tokens only** — Tailwind utilities from semantic tokens (`bg-surface`, `text-muted`, `p-4`). Palette classes don't exist; arbitrary values and raw `z-*` fail lint. Raw values live only in `@theme` in `src/styles/tokens.css`.
3. **Program to interfaces** — features get data only through `hooks/queries` and `hooks/mutations`; `components/` is a pure library; only hooks touch `utils/client` + `utils/endpoints`. (eslint boundaries)
4. **Small units** — complexity ≤10, file ≤200 lines, function ≤60 lines. Split, don't disable.

## Layout (create folders only when a plan calls for them)
- `components/` library · `features/<f>/` composed UI · `pages/` thin route shells
- `hooks/{queries,mutations,misc}` · `utils/{utils,formatter,constants,endpoints,client,monitoring}.ts` · `providers/` · `mocks/` · `types/`
- `styles/tokens.css` · tests co-located `*.test.tsx` · `e2e/` Playwright with `expectNoA11yViolations(page)` + `expectButtonsShowPointer(page)`

## Every UI must have
Loading, empty, error (with retry) and ready states · keyboard operable · visible focus · labelled controls ·
works at 375px and 1280px · respects `prefers-reduced-motion` · every button is a `<Button>` and shows `cursor-pointer`.

## Skills
`design-system`, `component`, `testing`, `api-integration` (in the root `.claude/skills/`), plus `vercel-react-best-practices` and `vercel-composition-patterns` while writing components.

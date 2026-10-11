---
name: p6-playwright-notes
description: Faster QA of the P6 workspace via scripted Playwright; selectors that work
metadata:
  type: reference
---

- 2026-10-11 — Scripted Playwright (import from frontend/node_modules/@playwright/test/index.mjs) beat agent-browser for whole-criteria passes; focused skip link overlays the Entries button, so Tab then Tab before clicking.
- Reliable roles: combobox "Filter by language" + option; button "What do these mean?" (toggletip, role=tooltip exists in DOM; check visibility not count); tabs "Your text"/"Corrected"; highlight buttons "yo es (error)"; Insights dialog h2 "Insights"; entry mock id 00000000-0000-4000-8000-000000000002.
- Toast needs waiting for "Analyzing" before opening another entry on /?mock=slow. Dark scheme check: compare screenshot bytes light vs dark.

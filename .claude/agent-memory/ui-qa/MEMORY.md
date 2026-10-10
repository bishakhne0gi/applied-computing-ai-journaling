# ui-qa memory

<!-- One line per learning: date — lesson. Keep under 50 lines; merge duplicates. -->
- 2026-10-10 — `agent-browser eval` is permission-denied; check focus via screenshots (focus ring) and `get attr`; compound `;` commands with eval get blocked.
- 2026-10-10 — Relative screenshot paths are not saved in cwd; always use absolute paths. Default browser is dark scheme; `set media light|dark` works (not `media`).
- 2026-10-10 — History "Load more": mouse click via ref/find did nothing in 4 tries but focus+Enter worked (flaky or real bug); Language select via `select "select" "French"`.
- 2026-10-10 — Mock transient states (Saved. Analyzing…, alert after fail) vanish fast; poll with snapshot right after click. Mock data resets on each page load.

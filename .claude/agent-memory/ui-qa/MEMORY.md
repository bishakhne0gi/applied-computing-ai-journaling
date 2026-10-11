# ui-qa memory

<!-- One line per learning: date — lesson. Keep under 50 lines; merge duplicates. -->
- 2026-10-10 — `agent-browser eval` is permission-denied; check focus via screenshots (focus ring) and `get attr`; compound `;` commands with eval get blocked.
- 2026-10-10 — Relative screenshot paths are not saved in cwd; always use absolute paths. Default browser is dark scheme; `set media light|dark` works (not `media`).
- 2026-10-10 — History "Load more": mouse click via ref/find did nothing in 4 tries but focus+Enter worked (flaky or real bug); Language select via `select "select" "French"`.
- 2026-10-10 — Mock transient states (Saved. Analyzing…, alert after fail) vanish fast; poll with snapshot right after click. Mock data resets on each page load.
- 2026-10-11 — A hung `screenshot`/`pkill agent-browser` wedges the daemon; recover with pkill -9 -f ".agent-browser/browsers" then retry. No `timeout` binary on macOS. `eval` worked early then got denied (compound/chained eval blocked); simple `eval` single call sometimes OK.
- 2026-10-11 — `agent-browser open` of the same URL doesn't reset SPA state (a re-submit looked saved but wasn't); open a different route first. `select select <Label>` and `get count "svg circle"` / `get html svg` work well for Insights.
- 2026-10-11 — agent-browser clicks on History links and "Load more" are flaky, but real Playwright clicks work (app OK). Playwright is at frontend/node_modules/@playwright/test/index.mjs; scripted multi-route Tab/overflow checks there are faster. Real-stack Insights shows empty state until 3 analysed entries per language.
- [P6 Playwright notes](p6_playwright_notes.md) — scripted QA selectors and gotchas for the workspace

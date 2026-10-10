---
paths:
  - "ai/tests/**"
  - "backend/tests/**"
---
# Python test rules
- One behaviour per test, named by behaviour: `test_<what happens>_when_<condition>`.
- Unit tests touch no network and no database. Integration tests use real Postgres via the `db_session` / `client` fixtures — never SQLite.
- AI is always the `FakeProvider` (scripted outputs or exceptions); no test calls a real model.
- Parametrize input tables instead of copy-pasting tests.
- A test must fail when the behaviour breaks — if deleting the implementation line doesn't fail it, rewrite it.

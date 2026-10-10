# Language Journal

AI-assisted journaling for language learners. `frontend/` (Vite + React SPA) · `backend/` (FastAPI) · `ai/` (`journal_ai` package + evals).
Spec: `docs/superpowers/specs/2026-10-10-ai-language-journal-design.md` · Plans: `docs/superpowers/plans/` (index lists status).

## Commands
- `make install` · `make db` · `make migrate` · `make dev-backend` · `make dev-frontend` · `make up` (full stack on :8080)
- `make verify-fast` (lint + types everywhere) · `make verify` (every gate, CI order) · `make test-ai` · `make test-backend`

## Rules
- Backend layers: api → services → repositories → db. Routes never touch the ORM; repositories hold no business rules; services depend on the `Analyzer` protocol, never a provider SDK. (import-linter)
- `journal_ai` never imports the backend, FastAPI or SQLAlchemy. (import-linter)
- Frontend rules: `frontend/CLAUDE.md`. Backend: `backend/CLAUDE.md`. AI: `ai/CLAUDE.md`.
- Comments explain why, never what. No comments restating code, no commented-out code, no docstrings on obvious functions.
- Never log entry text or send it to Sentry. Never print or commit `.env`; `.env.example` documents every variable.
- Failing test first. One commit per plan step, then `git push`.
- Commits and PRs carry no AI attribution: no `Co-Authored-By` trailers, no "Generated with" lines.
- No new dependency without a one-line reason in the commit body and the phase plan.

## Never
Disable a lint/type rule or lower a threshold to pass a gate · use `Any`/`any` without a reason · skip a failing test ·
claim done without showing `make verify` output · force-push.

## Agents
`test-writer` (failing tests first) · `reviewer` (one read-only pass per phase) · `ui-qa` (browser checks per acceptance criterion). Memory: `.claude/agent-memory/<name>/MEMORY.md`.

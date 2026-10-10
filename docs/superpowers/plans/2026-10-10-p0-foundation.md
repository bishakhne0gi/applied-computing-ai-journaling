# P0 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A runnable, gated monorepo skeleton: uv workspace (`ai/`, `backend/`), ported frontend kit, FastAPI app with config/logging/errors/Sentry/health, Postgres + Alembic, Docker Compose, agent harness and CI.

**Architecture:** Root uv workspace with two Python members (`journal-ai`, `journal-backend`) sharing one lockfile and one lint/type/test config. Frontend is a standalone pnpm project ported from a frontend starter kit. Compose runs `db → migrate → backend → frontend(nginx)`.

**Tech Stack:** Python 3.13, uv 0.12, FastAPI, pydantic-settings, SQLAlchemy 2 async + asyncpg, Alembic, structlog, sentry-sdk, pytest + pytest-asyncio + httpx, ruff, mypy strict, import-linter · Vite + React 19 + TS + Tailwind v4 (kit), @sentry/react · Postgres 16 · Docker Compose · GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-10-ai-language-journal-design.md`

## Global Constraints

- All paths below are relative to the repository root.
- Python `>=3.13`; Docker base `python:3.13-slim`; Node 24 in Docker/CI; pnpm 10.28.1 (`packageManager` field).
- Kit source: the frontend starter kit at `$KIT_DIR`. Ported files must contain no wording from the kit's original project (the private `.hygiene-terms` list) and no `(spec …)` references to the kit's own spec.
- Comments explain why, never what. No docstrings on obvious functions. No commented-out code.
- Never log entry text; never send request bodies to Sentry.
- `.env` is git-ignored and holds `ANTHROPIC_API_KEY`; never print, copy or commit it. `.env.example` documents every variable.
- Commits are authored by the repo owner only: no `Co-Authored-By` trailers, no AI attribution in commits, PRs or code. After every commit: `git push`.
- Errors are RFC 7807 `application/problem+json` with `request_id`.
- Gates are never weakened to pass.

## Review Focus

- A client sends a hostile or huge `X-Request-ID` (newlines, 10 KB) → it is replaced with a generated id, never echoed into logs or headers. (Task 2 test)
- Postgres is down → `/health` answers 503 `{"status":"degraded","database":"down"}`, not a 500 stack trace. (Task 3 test)
- An unhandled exception in a route → generic 500 problem+json with `request_id`; no traceback or exception text leaks. (Task 2 test)
- A Sentry event carries a request body with journal text → body is replaced with `[scrubbed]`. (Task 2 test)
- Someone commits kit wording or an `sk-ant-` key → `scripts/check-hygiene.sh` fails locally and in CI. (Task 1 test)

---

### Task 1: Workspace skeleton, shared tooling, hygiene check

**Files:**
- Create: `pyproject.toml`, `.python-version`, `.editorconfig`, `.env.example`, `.dockerignore`, `Makefile`, `README.md`, `scripts/check-hygiene.sh`
- Create: `ai/pyproject.toml`, `ai/journal_ai/__init__.py`, `ai/journal_ai/languages.py`, `ai/tests/test_languages.py`
- Create: `backend/pyproject.toml`, `backend/app/__init__.py`
- Modify: `.gitignore` (already exists; leave as is)

**Interfaces:**
- Produces: `journal_ai.languages.SUPPORTED_LANGUAGES: dict[str, str]` (code → English name) and `is_supported(code: str) -> bool`, used by P1 prompts and P2 validation. Make targets used by every later task: `verify-fast`, `verify`, `test-ai`, `test-backend`, `lint`, `typecheck`, `hygiene`.

- [ ] **Step 1: Root workspace files**

`pyproject.toml`:
```toml
[project]
name = "applied-computing-journal"
version = "0.1.0"
requires-python = ">=3.13"
dependencies = ["journal-ai", "journal-backend"]

[tool.uv]
package = false

[tool.uv.workspace]
members = ["ai", "backend"]

[tool.uv.sources]
journal-ai = { workspace = true }
journal-backend = { workspace = true }

[tool.ruff]
line-length = 110
target-version = "py313"
extend-exclude = ["frontend"]

[tool.ruff.lint]
select = ["E", "F", "W", "I", "B", "UP", "SIM", "C90", "N", "ASYNC", "S", "RUF", "PT", "TID", "PL", "ARG", "RET"]
ignore = ["PLR0913"]

[tool.ruff.lint.mccabe]
max-complexity = 10

[tool.ruff.lint.per-file-ignores]
"**/tests/**" = ["S101", "PLR2004", "ARG001"]
"backend/migrations/**" = ["N999", "E501"]

[tool.mypy]
python_version = "3.13"
strict = true
plugins = ["pydantic.mypy"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
addopts = "--import-mode=importlib -q"
pythonpath = ["backend"]
```

`.python-version`:
```
3.13
```

`.editorconfig`:
```ini
root = true

[*]
end_of_line = lf
insert_final_newline = true
charset = utf-8
indent_style = space
indent_size = 2

[*.py]
indent_size = 4

[Makefile]
indent_style = tab
```

`.env.example`:
```bash
# Copy to .env. Every variable is optional; defaults run the app locally with the fake AI provider.

# AI — set ANTHROPIC_API_KEY to use Claude; leave empty for the deterministic fake provider.
ANTHROPIC_API_KEY=
# AI_PROVIDER=anthropic|fake   (auto: anthropic when a key is set)
AI_MODEL=claude-opus-5-5
AI_EFFORT=medium
AI_TIMEOUT_SECONDS=30

DATABASE_URL=postgresql+asyncpg://journal:journal@localhost:5432/journal
TEST_DATABASE_URL=postgresql+asyncpg://journal:journal@localhost:5432/journal_test

LOG_LEVEL=INFO
LOG_FORMAT=console
CORS_ORIGINS=["http://localhost:5173"]

SENTRY_DSN=
SENTRY_ENVIRONMENT=development
RELEASE=dev

VITE_SENTRY_DSN=
```

`.dockerignore`:
```
.git
.env
.env.*
!.env.example
.hygiene-terms
**/__pycache__
**/.venv
**/.mypy_cache
**/.pytest_cache
**/.ruff_cache
frontend/node_modules
frontend/dist
frontend/coverage
docs
```

`README.md` (P5 replaces it with the full write-up):
```markdown
# Language Journal

AI-assisted journaling for language learners. Work in progress — see `docs/superpowers/specs/` for the design.

Quick start: `cp .env.example .env && make up`, then open http://localhost:8080.
```

- [ ] **Step 2: Package skeletons**

`ai/pyproject.toml`:
```toml
[project]
name = "journal-ai"
version = "0.1.0"
requires-python = ">=3.13"
dependencies = []

[build-system]
requires = ["uv_build>=0.12,<0.13"]
build-backend = "uv_build"

[tool.uv.build-backend]
module-name = "journal_ai"
module-root = ""
```

`ai/journal_ai/__init__.py`: empty file.

`backend/pyproject.toml`:
```toml
[project]
name = "journal-backend"
version = "0.1.0"
requires-python = ">=3.13"
dependencies = ["journal-ai"]

[tool.uv.sources]
journal-ai = { workspace = true }

[build-system]
requires = ["uv_build>=0.12,<0.13"]
build-backend = "uv_build"

[tool.uv.build-backend]
module-name = "app"
module-root = ""
```

`backend/app/__init__.py`: empty file.

- [ ] **Step 3: Install dev tooling and lock**

Run:
```bash
uv add --dev ruff mypy pytest pytest-asyncio pytest-cov httpx import-linter
uv add --package journal-ai pydantic
uv sync --all-packages
```
Expected: `uv.lock` created, `.venv/` created, no errors.

- [ ] **Step 4: Write the failing test for languages**

`ai/tests/test_languages.py`:
```python
import pytest

from journal_ai.languages import SUPPORTED_LANGUAGES, is_supported


def test_supported_languages_have_english_names() -> None:
    assert SUPPORTED_LANGUAGES == {
        "es": "Spanish",
        "fr": "French",
        "de": "German",
        "it": "Italian",
        "pt": "Portuguese",
    }


@pytest.mark.parametrize(("code", "expected"), [("es", True), ("ES", False), ("en", False), ("", False)])
def test_is_supported_matches_exact_codes(code: str, expected: bool) -> None:
    assert is_supported(code) is expected
```
- [ ] **Step 5: Run it to see it fail**

Run: `uv run pytest ai`
Expected: FAIL — `ModuleNotFoundError: No module named 'journal_ai.languages'`.

- [ ] **Step 6: Implement**

`ai/journal_ai/languages.py`:
```python
SUPPORTED_LANGUAGES: dict[str, str] = {
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
}


def is_supported(code: str) -> bool:
    return code in SUPPORTED_LANGUAGES
```

- [ ] **Step 7: Run tests to see them pass**

Run: `uv run pytest ai`
Expected: `5 passed`.

- [ ] **Step 8: Hygiene script and its check**

`scripts/check-hygiene.sh`:
```bash
#!/usr/bin/env bash
# Fails when private wording or an Anthropic key is tracked. The repo is public.
set -euo pipefail
cd "$(dirname "$0")/.."

pattern='sk-ant-[A-Za-z0-9_-]{10,}'
# Private wording lives outside the public repo: one term per line in the git-ignored .hygiene-terms,
# or pipe/newline-separated in HYGIENE_TERMS (CI secret).
terms="${HYGIENE_TERMS:-}"
if [ -f .hygiene-terms ]; then terms="$terms"$'\n'"$(cat .hygiene-terms)"; fi
extra="$(printf '%s\n' "$terms" | tr '|' '\n' | sed '/^[[:space:]]*$/d' | paste -sd '|' -)"
if [ -n "$extra" ]; then pattern="$pattern|$extra"; fi
matches="$(git ls-files -z -- . ':(exclude)docs/superpowers' ':(exclude)scripts/check-hygiene.sh' \
  | xargs -0 grep -nIiE "$pattern" -- 2>/dev/null || true)"

if [ -n "$matches" ]; then
  echo "$matches" >&2
  echo "hygiene: forbidden wording or secret found" >&2
  exit 1
fi
echo "hygiene: clean"
```
Run:
```bash
chmod +x scripts/check-hygiene.sh
git add -A && ./scripts/check-hygiene.sh
echo "sk-ant-api03-leakedkey" > leak.txt && git add leak.txt && ./scripts/check-hygiene.sh; echo "exit=$?"
git rm -q --cached leak.txt && rm leak.txt && ./scripts/check-hygiene.sh
```
Expected: `hygiene: clean`, then the `leak.txt:1:sk-ant-api03-leakedkey` line + `exit=1`, then `hygiene: clean`.

- [ ] **Step 9: Makefile**

`Makefile` (tabs for recipe indentation):
```makefile
.PHONY: install db migrate revision dev-backend dev-frontend up down lint typecheck test-ai test-backend test hygiene verify-fast verify

install:
	uv sync --all-packages
	pnpm -C frontend install

db:
	docker compose up -d db

migrate:
	cd backend && uv run alembic upgrade head

revision:
	cd backend && uv run alembic revision --autogenerate -m "$(m)"

dev-backend:
	uv run uvicorn app.main:create_app --factory --reload --app-dir backend --port 8000 --no-access-log

dev-frontend:
	pnpm -C frontend dev

up:
	docker compose up --build

down:
	docker compose down

lint:
	uv run ruff check .
	uv run ruff format --check .
	cd backend && uv run lint-imports

typecheck:
	uv run mypy ai/journal_ai backend/app

test-ai:
	uv run pytest ai

test-backend:
	uv run pytest backend --cov=app --cov-report=term-missing:skip-covered --cov-fail-under=85

test: test-ai test-backend

hygiene:
	./scripts/check-hygiene.sh

verify-fast: lint typecheck
	pnpm -C frontend verify:fast

verify: hygiene lint typecheck test
	pnpm -C frontend verify
```
`lint-imports`, `test-backend` and `pnpm -C frontend` become runnable in Tasks 2–4; do not run them yet.

- [ ] **Step 10: Lint the Python so far**

Run: `uv run ruff check . && uv run ruff format --check . && uv run mypy ai/journal_ai`
Expected: all pass (run `uv run ruff format .` once if format reports changes, then re-run).

- [ ] **Step 11: Commit and push**

```bash
git add -A
git commit -m "chore: uv workspace, shared tooling and hygiene check"
git push
```

---

### Task 2: Backend core — config, logging, request context, errors, Sentry, app factory

**Files:**
- Create: `backend/app/core/__init__.py`, `backend/app/core/config.py`, `backend/app/core/logging.py`, `backend/app/core/request_context.py`, `backend/app/core/errors.py`, `backend/app/core/sentry.py`, `backend/app/main.py`
- Create: `backend/app/api/__init__.py`, `backend/app/api/routes/__init__.py`, `backend/app/services/__init__.py`, `backend/app/repositories/__init__.py`, `backend/app/db/__init__.py` (empty packages so layering contracts resolve)
- Create: `backend/tests/support.py`, `backend/tests/conftest.py`, `backend/tests/unit/test_config.py`, `backend/tests/unit/test_request_context.py`, `backend/tests/unit/test_errors.py`, `backend/tests/unit/test_sentry.py`
- Modify: `backend/pyproject.toml` (import-linter contracts)

**Interfaces:**
- Produces:
  - `app.core.config.Settings` (fields: `environment, release, database_url, log_level, log_format, cors_origins, sentry_dsn, ai_provider, ai_model, ai_effort, ai_timeout_seconds, anthropic_api_key`) with property `resolved_ai_provider -> Literal["anthropic","fake"]`; `get_settings() -> Settings` (cached).
  - `app.core.logging.configure_logging(level: str, fmt: Literal["json","console"]) -> None`
  - `app.core.request_context.RequestContextMiddleware`, `REQUEST_ID_HEADER = "X-Request-ID"`
  - `app.core.errors.AppError(detail)` (class attrs `status_code`, `title`), `NotFoundError`, `register_exception_handlers(app)`
  - `app.core.sentry.init_sentry(settings) -> None`, `scrub_event(event, hint) -> event`
  - `app.main.create_app(settings: Settings | None = None) -> FastAPI` — uvicorn runs it with `--factory`.
  - Test helpers: `ClientFactory` type in `backend/tests/support.py`; fixtures `settings` and `make_client` in `backend/tests/conftest.py`.

- [ ] **Step 1: Add dependencies**

Run:
```bash
uv add --package journal-backend fastapi "uvicorn[standard]" pydantic-settings structlog "sentry-sdk[fastapi]"
```
Expected: lock updated.

- [ ] **Step 2: Write failing tests**

`backend/tests/support.py`:
```python
from collections.abc import Callable
from contextlib import AbstractAsyncContextManager

from fastapi import FastAPI
from httpx import AsyncClient

ClientFactory = Callable[[FastAPI], AbstractAsyncContextManager[AsyncClient]]
```

`backend/tests/conftest.py`:
```python
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings
from tests.support import ClientFactory


@pytest.fixture
def settings() -> Settings:
    return Settings(_env_file=None, log_format="console", sentry_dsn=None)


@pytest.fixture
def make_client() -> ClientFactory:
    @asynccontextmanager
    async def factory(app: FastAPI) -> AsyncIterator[AsyncClient]:
        transport = ASGITransport(app=app, raise_app_exceptions=False)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            yield client

    return factory
```

`backend/tests/unit/test_config.py`:
```python
import pytest
from pydantic import SecretStr

from app.core.config import Settings


def test_defaults_run_locally_with_the_fake_provider() -> None:
    settings = Settings(_env_file=None)

    assert settings.resolved_ai_provider == "fake"
    assert settings.ai_model == "claude-opus-5-5"
    assert settings.log_format == "console"


def test_an_api_key_selects_anthropic_automatically() -> None:
    settings = Settings(_env_file=None, anthropic_api_key=SecretStr("k"))

    assert settings.resolved_ai_provider == "anthropic"


def test_an_explicit_provider_wins_over_the_key() -> None:
    settings = Settings(_env_file=None, anthropic_api_key=SecretStr("k"), ai_provider="fake")

    assert settings.resolved_ai_provider == "fake"


def test_environment_variables_override_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LOG_FORMAT", "json")
    monkeypatch.setenv("CORS_ORIGINS", '["http://a.test"]')

    settings = Settings(_env_file=None)

    assert settings.log_format == "json"
    assert settings.cors_origins == ["http://a.test"]
```

`backend/tests/unit/test_request_context.py`:
```python
import pytest
from structlog.testing import capture_logs

from app.core.config import Settings
from app.core.request_context import REQUEST_ID_HEADER
from app.main import create_app
from tests.support import ClientFactory


async def test_generates_a_request_id_and_echoes_it(settings: Settings, make_client: ClientFactory) -> None:
    app = create_app(settings)
    app.add_api_route("/ping", lambda: {"ok": True})

    async with make_client(app) as client:
        response = await client.get("/ping")

    assert len(response.headers[REQUEST_ID_HEADER]) == 32


async def test_honours_a_valid_incoming_request_id(settings: Settings, make_client: ClientFactory) -> None:
    app = create_app(settings)
    app.add_api_route("/ping", lambda: {"ok": True})

    async with make_client(app) as client:
        response = await client.get("/ping", headers={REQUEST_ID_HEADER: "abc-123"})

    assert response.headers[REQUEST_ID_HEADER] == "abc-123"


@pytest.mark.parametrize("hostile", ["a b", "x" * 65, "<script>", "../../etc"])
async def test_replaces_a_hostile_request_id(settings: Settings, make_client: ClientFactory, hostile: str) -> None:
    app = create_app(settings)
    app.add_api_route("/ping", lambda: {"ok": True})

    async with make_client(app) as client:
        response = await client.get("/ping", headers={REQUEST_ID_HEADER: hostile})

    assert response.headers[REQUEST_ID_HEADER] != hostile
    assert len(response.headers[REQUEST_ID_HEADER]) == 32


async def test_logs_one_line_per_request_with_the_request_id(
    settings: Settings, make_client: ClientFactory
) -> None:
    app = create_app(settings)
    app.add_api_route("/ping", lambda: {"ok": True})

    with capture_logs() as logs:
        async with make_client(app) as client:
            response = await client.get("/ping")

    request_logs = [log for log in logs if log["event"] == "request"]
    assert len(request_logs) == 1
    assert request_logs[0]["status"] == 200
    assert request_logs[0]["path"] == "/ping"
    assert request_logs[0]["request_id"] == response.headers[REQUEST_ID_HEADER]
```
Note: `capture_logs` drops contextvars processors, so the middleware must pass `request_id` explicitly on the request log line (it does in Step 3).

`backend/tests/unit/test_errors.py`:
```python
from app.core.config import Settings
from app.core.errors import NotFoundError
from app.main import create_app
from tests.support import ClientFactory

PROBLEM_JSON = "application/problem+json"


async def test_unknown_route_returns_problem_json(settings: Settings, make_client: ClientFactory) -> None:
    async with make_client(create_app(settings)) as client:
        response = await client.get("/nope")

    body = response.json()
    assert response.status_code == 404
    assert response.headers["content-type"] == PROBLEM_JSON
    assert body["title"] == "Not Found"
    assert body["instance"] == "/nope"
    assert body["request_id"]


async def test_app_errors_keep_their_status_and_detail(settings: Settings, make_client: ClientFactory) -> None:
    app = create_app(settings)

    def missing() -> None:
        raise NotFoundError("Entry 42 not found")

    app.add_api_route("/missing", missing)

    async with make_client(app) as client:
        response = await client.get("/missing")

    assert response.status_code == 404
    assert response.json()["detail"] == "Entry 42 not found"


async def test_unhandled_errors_hide_internals(settings: Settings, make_client: ClientFactory) -> None:
    app = create_app(settings)

    def boom() -> None:
        raise RuntimeError("database password is hunter2")

    app.add_api_route("/boom", boom)

    async with make_client(app) as client:
        response = await client.get("/boom")

    assert response.status_code == 500
    assert response.headers["content-type"] == PROBLEM_JSON
    assert "hunter2" not in response.text
    assert response.json()["request_id"]


async def test_validation_errors_list_the_failing_fields(settings: Settings, make_client: ClientFactory) -> None:
    app = create_app(settings)

    def needs_int(n: int) -> dict[str, int]:
        return {"n": n}

    app.add_api_route("/needs-int", needs_int)

    async with make_client(app) as client:
        response = await client.get("/needs-int", params={"n": "x"})

    assert response.status_code == 422
    assert response.json()["errors"][0]["loc"] == ["query", "n"]
```

`backend/tests/unit/test_sentry.py`:
```python
import pytest
import sentry_sdk

from app.core.config import Settings
from app.core.sentry import init_sentry, scrub_event


def test_scrub_event_removes_request_bodies() -> None:
    event = {"request": {"url": "/api/v1/entries", "data": {"text": "Hoy fui al mercado"}}}

    scrubbed = scrub_event(event, {})

    assert scrubbed is not None
    assert scrubbed["request"]["data"] == "[scrubbed]"
    assert scrubbed["request"]["url"] == "/api/v1/entries"


def test_scrub_event_passes_events_without_a_request() -> None:
    event = {"message": "boom"}

    assert scrub_event(event, {}) == {"message": "boom"}


def test_init_sentry_is_a_no_op_without_a_dsn(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[object] = []
    monkeypatch.setattr(sentry_sdk, "init", lambda **kwargs: calls.append(kwargs))

    init_sentry(Settings(_env_file=None, sentry_dsn=None))

    assert calls == []


def test_init_sentry_never_sends_pii(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[dict[str, object]] = []
    monkeypatch.setattr(sentry_sdk, "init", lambda **kwargs: calls.append(kwargs))

    init_sentry(Settings(_env_file=None, sentry_dsn="https://k@o.ingest.sentry.io/1", release="abc"))

    assert calls[0]["send_default_pii"] is False
    assert calls[0]["release"] == "abc"
    assert calls[0]["before_send"] is scrub_event
```

- [ ] **Step 3: Run tests to see them fail**

Run: `uv run pytest backend`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.core'`.

- [ ] **Step 4: Implement config**

`backend/app/core/__init__.py`: empty.

`backend/app/core/config.py`:
```python
from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

ProviderName = Literal["anthropic", "fake"]


class Settings(BaseSettings):
    # Root .env first, package-local .env second so `make dev-backend` and `alembic` (run in backend/) agree.
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")

    environment: str = "development"
    release: str = "dev"
    database_url: str = "postgresql+asyncpg://journal:journal@localhost:5432/journal"
    log_level: str = "INFO"
    log_format: Literal["json", "console"] = "console"
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])
    sentry_dsn: str | None = None

    ai_provider: ProviderName | None = None
    ai_model: str = "claude-opus-5-5"
    ai_effort: Literal["low", "medium", "high"] = "medium"
    ai_timeout_seconds: float = 30.0
    anthropic_api_key: SecretStr | None = None

    @property
    def resolved_ai_provider(self) -> ProviderName:
        if self.ai_provider:
            return self.ai_provider
        return "anthropic" if self.anthropic_api_key else "fake"


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 5: Implement logging and request context**

`backend/app/core/logging.py`:
```python
import logging
import sys
from typing import Literal

import structlog


def configure_logging(level: str, fmt: Literal["json", "console"]) -> None:
    renderer: structlog.typing.Processor = (
        structlog.processors.JSONRenderer() if fmt == "json" else structlog.dev.ConsoleRenderer()
    )
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            structlog.processors.format_exc_info,
            renderer,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.getLevelNamesMapping()[level.upper()]),
        logger_factory=structlog.PrintLoggerFactory(sys.stdout),
        cache_logger_on_first_use=False,
    )
```

`backend/app/core/request_context.py`:
```python
import re
import time
import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

REQUEST_ID_HEADER = "X-Request-ID"
# Incoming ids end up in logs and response headers, so only short, plain tokens are trusted.
_SAFE_REQUEST_ID = re.compile(r"[A-Za-z0-9-]{1,64}")

logger = structlog.get_logger()


def _request_id_from(request: Request) -> str:
    incoming = request.headers.get(REQUEST_ID_HEADER, "")
    return incoming if _SAFE_REQUEST_ID.fullmatch(incoming) else uuid.uuid4().hex


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = _request_id_from(request)
        request.state.request_id = request_id
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        started = time.perf_counter()
        response = await call_next(request)
        response.headers[REQUEST_ID_HEADER] = request_id
        logger.info(
            "request",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=round((time.perf_counter() - started) * 1000, 1),
        )
        return response
```

- [ ] **Step 6: Implement errors**

`backend/app/core/errors.py`:
```python
from http import HTTPStatus
from typing import Any

import structlog
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.request_context import REQUEST_ID_HEADER

PROBLEM_JSON = "application/problem+json"
logger = structlog.get_logger()


class AppError(Exception):
    status_code: HTTPStatus = HTTPStatus.INTERNAL_SERVER_ERROR
    title: str = "Internal Server Error"

    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class NotFoundError(AppError):
    status_code = HTTPStatus.NOT_FOUND
    title = "Not Found"


def problem(request: Request, status: int, title: str, detail: str, **extra: Any) -> JSONResponse:
    request_id: str | None = getattr(request.state, "request_id", None)
    body = {
        "type": "about:blank",
        "title": title,
        "status": status,
        "detail": detail,
        "instance": request.url.path,
        "request_id": request_id,
        **extra,
    }
    headers = {REQUEST_ID_HEADER: request_id} if request_id else None
    return JSONResponse(body, status_code=status, media_type=PROBLEM_JSON, headers=headers)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        return problem(request, exc.status_code, exc.title, exc.detail)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        # Only location, message and type: echoing `input` would put journal text into responses and logs.
        errors = [{"loc": list(e["loc"]), "msg": e["msg"], "type": e["type"]} for e in exc.errors()]
        return problem(request, 422, "Unprocessable Content", "Request validation failed", errors=errors)

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        return problem(request, exc.status_code, HTTPStatus(exc.status_code).phrase, str(exc.detail))

    @app.exception_handler(Exception)
    async def handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled_error", path=request.url.path)
        return problem(request, 500, "Internal Server Error", "Something went wrong")
```

- [ ] **Step 7: Implement Sentry**

`backend/app/core/sentry.py`:
```python
from typing import Any

import sentry_sdk

from app.core.config import Settings

SCRUBBED = "[scrubbed]"


def scrub_event(event: Any, hint: Any) -> Any:
    request = event.get("request")
    if isinstance(request, dict) and "data" in request:
        request["data"] = SCRUBBED
    return event


def init_sentry(settings: Settings) -> None:
    if not settings.sentry_dsn:
        return
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        release=settings.release,
        send_default_pii=False,
        traces_sample_rate=0.1,
        before_send=scrub_event,
    )
```

- [ ] **Step 8: Implement the app factory and empty layer packages**

Create empty `__init__.py` in `backend/app/api/`, `backend/app/api/routes/`, `backend/app/services/`, `backend/app/repositories/`, `backend/app/db/`.

`backend/app/main.py`:
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import Settings, get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.core.request_context import REQUEST_ID_HEADER, RequestContextMiddleware
from app.core.sentry import init_sentry


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level, settings.log_format)
    init_sentry(settings)

    app = FastAPI(title="Language Journal API", version=settings.release)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=[REQUEST_ID_HEADER],
    )
    app.add_middleware(RequestContextMiddleware)
    register_exception_handlers(app)
    return app
```

- [ ] **Step 9: Run tests to see them pass**

Run: `uv run pytest backend`
Expected: all tests pass.

- [ ] **Step 10: Layering contracts**

Append to `backend/pyproject.toml`:
```toml
[tool.importlinter]
root_packages = ["app", "journal_ai"]
include_external_packages = true

[[tool.importlinter.contracts]]
name = "Backend layers"
type = "layers"
layers = ["app.api", "app.services", "app.repositories", "app.db"]

[[tool.importlinter.contracts]]
name = "journal_ai is independent of the backend"
type = "forbidden"
source_modules = ["journal_ai"]
forbidden_modules = ["app", "fastapi", "sqlalchemy"]

[[tool.importlinter.contracts]]
name = "Backend never talks to a provider SDK directly"
type = "forbidden"
source_modules = ["app"]
forbidden_modules = ["anthropic"]
```
Run: `cd backend && uv run lint-imports; cd ..`
Expected: `Contracts: 3 kept, 0 broken.` If import-linter errors because `anthropic` is not installed yet, temporarily drop that contract and re-add it in P1 Task 4 (note it in the commit message).

- [ ] **Step 11: Lint, type-check, commit, push**

Run: `uv run ruff check . && uv run ruff format --check . && uv run mypy ai/journal_ai backend/app`
Expected: clean.
```bash
git add -A
git commit -m "feat(backend): app factory with config, structured logging, problem+json errors and Sentry"
git push
```

---

### Task 3: Database session, Alembic, and `/health`

**Files:**
- Create: `backend/app/db/base.py`, `backend/app/db/session.py`, `backend/app/db/models/__init__.py`
- Create: `backend/app/api/deps.py`, `backend/app/api/schemas/__init__.py`, `backend/app/api/schemas/health.py`, `backend/app/api/routes/health.py`
- Create: `backend/app/services/health.py`, `backend/app/repositories/system.py`
- Create: `backend/alembic.ini`, `backend/migrations/env.py`, `backend/migrations/script.py.mako`, `backend/migrations/versions/.gitkeep`
- Create: `infra/postgres/init.sql`, `docker-compose.yml` (db service only; Task 5 adds the rest)
- Create: `backend/tests/integration/conftest.py`, `backend/tests/integration/test_health.py`, `backend/tests/unit/test_health.py`
- Modify: `backend/app/main.py` (lifespan + health router)

**Interfaces:**
- Consumes: `create_app`, `Settings`, `make_client` (Task 2).
- Produces:
  - `app.db.base.Base` (DeclarativeBase with naming convention) — P2 models subclass it.
  - `app.db.session.create_engine(url) -> AsyncEngine`, `create_sessionmaker(engine) -> async_sessionmaker[AsyncSession]`
  - `app.api.deps.get_session` (async generator dependency), `SessionDep = Annotated[AsyncSession, Depends(get_session)]`
  - Fixtures in `backend/tests/integration/conftest.py`: `db_session: AsyncSession` (rolled back per test) and `client: AsyncClient` (app with `get_session` overridden to `db_session`).
  - `GET /health` → `{"status": "ok"|"degraded", "database": "up"|"down"}`, 200 or 503.

- [ ] **Step 1: Dependencies and local Postgres**

Run: `uv add --package journal-backend "sqlalchemy[asyncio]" asyncpg alembic`

`infra/postgres/init.sql`:
```sql
CREATE DATABASE journal_test;
```

`docker-compose.yml`:
```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: journal
      POSTGRES_PASSWORD: journal
      POSTGRES_DB: journal
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./infra/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U journal -d journal"]
      interval: 2s
      timeout: 3s
      retries: 30

volumes:
  pgdata:
```
Run: `docker compose up -d db && docker compose exec db psql -U journal -lqt | cut -d'|' -f1 | grep -w journal_test`
Expected: `journal_test` printed (wait for the healthcheck if the first attempt fails).

- [ ] **Step 2: Write failing tests**

`backend/tests/unit/test_health.py`:
```python
from typing import Any

from app.api.deps import get_session
from app.core.config import Settings
from app.main import create_app
from tests.support import ClientFactory


class UnreachableSession:
    async def execute(self, *args: Any, **kwargs: Any) -> None:
        raise ConnectionRefusedError("db down")


async def test_health_reports_degraded_when_the_database_is_down(
    settings: Settings, make_client: ClientFactory
) -> None:
    app = create_app(settings)
    app.dependency_overrides[get_session] = lambda: UnreachableSession()

    async with make_client(app) as client:
        response = await client.get("/health")

    assert response.status_code == 503
    assert response.json() == {"status": "degraded", "database": "down"}
```

`backend/tests/integration/conftest.py`:
```python
import asyncio
import os
from collections.abc import AsyncIterator

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

import app.db.models  # noqa: F401  registers models on Base.metadata
from app.api.deps import get_session
from app.core.config import Settings
from app.db.base import Base
from app.main import create_app
from tests.support import ClientFactory

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+asyncpg://journal:journal@localhost:5432/journal_test"
)


@pytest.fixture(scope="session")
def _schema() -> None:
    async def reset() -> None:
        engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
        await engine.dispose()

    asyncio.run(reset())


@pytest.fixture
async def db_session(_schema: None) -> AsyncIterator[AsyncSession]:
    # Each test runs inside an outer transaction that is rolled back; service commits become savepoints.
    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    async with engine.connect() as conn:
        transaction = await conn.begin()
        session = AsyncSession(bind=conn, expire_on_commit=False, join_transaction_mode="create_savepoint")
        try:
            yield session
        finally:
            await session.close()
            await transaction.rollback()
    await engine.dispose()


@pytest.fixture
async def client(
    settings: Settings, db_session: AsyncSession, make_client: ClientFactory
) -> AsyncIterator[AsyncClient]:
    app = create_app(settings)
    app.dependency_overrides[get_session] = lambda: db_session
    async with make_client(app) as http:
        yield http
```

`backend/tests/integration/test_health.py`:
```python
from httpx import AsyncClient


async def test_health_is_ok_when_the_database_answers(client: AsyncClient) -> None:
    response = await client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "up"}
```

- [ ] **Step 3: Run tests to see them fail**

Run: `uv run pytest backend`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.api.deps'`.

- [ ] **Step 4: Implement DB plumbing**

`backend/app/db/base.py`:
```python
from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

# Deterministic constraint names keep Alembic autogenerate diffs stable.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
```

`backend/app/db/session.py`:
```python
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine


def create_engine(url: str) -> AsyncEngine:
    return create_async_engine(url, pool_pre_ping=True)


def create_sessionmaker(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False)
```

`backend/app/db/models/__init__.py`: empty (P2 imports each model here).

`backend/app/repositories/system.py`:
```python
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession


async def database_is_reachable(session: AsyncSession) -> bool:
    try:
        await session.execute(text("SELECT 1"))
    except (SQLAlchemyError, OSError):
        return False
    return True
```

`backend/app/services/health.py`:
```python
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.system import database_is_reachable


@dataclass(frozen=True)
class HealthStatus:
    database_up: bool

    @property
    def healthy(self) -> bool:
        return self.database_up


async def check_health(session: AsyncSession) -> HealthStatus:
    return HealthStatus(database_up=await database_is_reachable(session))
```

`backend/app/api/deps.py`:
```python
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    async with request.app.state.sessionmaker() as session:
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]
```

`backend/app/api/schemas/__init__.py`: empty.

`backend/app/api/schemas/health.py`:
```python
from typing import Literal

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    database: Literal["up", "down"]
```

`backend/app/api/routes/health.py`:
```python
from fastapi import APIRouter, Response, status

from app.api.deps import SessionDep
from app.api.schemas.health import HealthResponse
from app.services.health import check_health

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse, responses={503: {"model": HealthResponse}})
async def health(session: SessionDep, response: Response) -> HealthResponse:
    result = await check_health(session)
    if not result.healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return HealthResponse(
        status="ok" if result.healthy else "degraded",
        database="up" if result.database_up else "down",
    )
```

Modify `backend/app/main.py` — final content:
```python
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health
from app.core.config import Settings, get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.core.request_context import REQUEST_ID_HEADER, RequestContextMiddleware
from app.core.sentry import init_sentry
from app.db.session import create_engine, create_sessionmaker


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level, settings.log_format)
    init_sentry(settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        engine = create_engine(settings.database_url)
        app.state.sessionmaker = create_sessionmaker(engine)
        yield
        await engine.dispose()

    app = FastAPI(title="Language Journal API", version=settings.release, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=[REQUEST_ID_HEADER],
    )
    app.add_middleware(RequestContextMiddleware)
    register_exception_handlers(app)
    app.include_router(health.router)
    return app
```

- [ ] **Step 5: Run tests to see them pass**

Run: `uv run pytest backend`
Expected: all tests pass.

- [ ] **Step 6: Alembic (async)**

Run: `cd backend && uv run alembic init -t async migrations && cd ..`
Then edit `backend/alembic.ini`: keep `script_location = %(here)s/migrations` (or `migrations`), set
`file_template = %%(year)d%%(month).2d%%(day).2d_%%(rev)s_%%(slug)s`, and delete the `sqlalchemy.url = ...` line.
Replace `backend/migrations/env.py` with:
```python
import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

import app.db.models  # noqa: F401  registers models on Base.metadata
from app.core.config import get_settings
from app.db.base import Base

config = context.config
config.set_main_option("sqlalchemy.url", get_settings().database_url)
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    engine = async_engine_from_config(
        config.get_section(config.config_ini_section, {}), prefix="sqlalchemy.", poolclass=pool.NullPool
    )
    async with engine.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_async_migrations())
```
Create `backend/migrations/versions/.gitkeep`. Delete `backend/migrations/README` if generated.
Run: `cd backend && uv run alembic upgrade head && uv run alembic check; cd ..`
Expected: `No new upgrade operations detected.`

- [ ] **Step 7: Gates, commit, push**

Run: `make lint typecheck test-backend`
Expected: all green; coverage ≥85%.
```bash
git add -A
git commit -m "feat(backend): async Postgres session, Alembic and /health with DB check"
git push
```

---

### Task 4: Port the frontend kit and add monitoring

**Files:**
- Create: `frontend/` (scaffold + kit files), `frontend/CLAUDE.md`, `frontend/src/env.d.ts`, `frontend/src/utils/monitoring.ts`, `frontend/src/utils/monitoring.test.ts`
- Modify: `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/App.test.tsx`, `frontend/e2e/smoke.spec.ts`, `frontend/index.html`, `frontend/package.json`

**Interfaces:**
- Produces: `initMonitoring(dsn?: string): Promise<void>` in `frontend/src/utils/monitoring.ts`; `pnpm verify` / `pnpm verify:fast` scripts; kit primitives conventions for P3.

- [ ] **Step 1: Scaffold and copy the kit (no `.claude`, no kit docs)**

Run from repo root:
```bash
KIT="${KIT_DIR:?set KIT_DIR to the frontend starter kit}"
npx -y create-vite@9.2.1 frontend --template react-ts --eslint --no-interactive --no-immediate
cd frontend
rm -rf src/assets public/icons.svg src/App.css src/index.css eslint.config.js README.md tsconfig*.json
rsync -a --exclude '.claude' --exclude 'CLAUDE.md' --exclude 'HANDOVER.md' --exclude 'docs' \
  --exclude '.DS_Store' --exclude 'package.scripts.json' "$KIT"/ ./
node -e '
  const fs=require("fs");const p=JSON.parse(fs.readFileSync("package.json"));
  p.name="journal-frontend";p.packageManager="pnpm@10.28.1";
  p.scripts=JSON.parse(fs.readFileSync(process.argv[1]));
  fs.writeFileSync("package.json",JSON.stringify(p,null,2)+"\n");' "$KIT/package.scripts.json"
```

- [ ] **Step 2: Install the kit's pinned toolchain**

Run (inside `frontend/`):
```bash
pnpm install
pnpm add -D eslint@9.39.5 @eslint/js@9.39.5 typescript@6.0.3 typescript-eslint@8.70.1 globals@17.12.0 \
  eslint-plugin-react-hooks@7.1.1 eslint-plugin-react-refresh@0.5.7 eslint-plugin-jsx-a11y@6.10.2 eslint-plugin-sonarjs@4.2.1 \
  stylelint@17.15.0 stylelint-config-standard@40.0.0 stylelint-declaration-strict-value@1.12.1 \
  vitest@5.0.2 @vitest/coverage-v8@5.0.2 jsdom@30.1.1 @testing-library/react@16.3.3 @testing-library/user-event@14.6.7 \
  @testing-library/jest-dom@7.0.1 @playwright/test@1.63.0 @axe-core/playwright@4.13.0 fallow@3.29.0 lighthouse@13.5.0
pnpm add -D tailwindcss@4.3.3 @tailwindcss/vite@4.3.3 eslint-plugin-better-tailwindcss@4.7.0
pnpm add clsx@2.1.1 tailwind-merge@3.7.0
pnpm add @sentry/react
pnpm exec playwright install chromium
printf '\ncoverage\ntest-results\nplaywright-report\n.lighthouse\n' >> .gitignore
```
`@sentry/react` reason (record in the commit body): frontend error reporting required by spec §9; loaded lazily.

- [ ] **Step 3: Strip kit-spec references and name the app**

Run (inside `frontend/`):
```bash
grep -rlE ' \(spec[^)]*\)' --exclude-dir=node_modules . | xargs perl -pi -e 's/ \(spec[^)]*\)//g'
perl -pi -e 's#<title>.*</title>#<title>Language Journal</title>#' index.html
grep -rnE 'spec v|spec §' --exclude-dir=node_modules . ; echo "leftovers-exit=$?"
```
Expected: `leftovers-exit=1` (no matches).

- [ ] **Step 4: Failing tests for the shell title and monitoring**

`frontend/src/App.test.tsx`:
```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App shell', () => {
  it('names the product in the top-level heading so every page has an accessible title', () => {
    // Arrange
    render(<App />)
    // Act
    const heading = screen.getByRole('heading', { level: 1 })
    // Assert
    expect(heading).toHaveTextContent('Language Journal')
  })
})
```

`frontend/src/utils/monitoring.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { init } = vi.hoisted(() => ({ init: vi.fn() }))
vi.mock('@sentry/react', () => ({ init }))

import { initMonitoring } from './monitoring'

describe('initMonitoring', () => {
  beforeEach(() => init.mockClear())

  it('stays off without a DSN so local runs send nothing', async () => {
    // Arrange
    const dsn = ''
    // Act
    await initMonitoring(dsn)
    // Assert
    expect(init).not.toHaveBeenCalled()
  })

  it('initialises Sentry without personal data when a DSN is set', async () => {
    // Arrange
    const dsn = 'https://key@o1.ingest.sentry.io/1'
    // Act
    await initMonitoring(dsn)
    // Assert
    expect(init).toHaveBeenCalledWith(expect.objectContaining({ dsn, sendDefaultPii: false }))
  })
})
```

Run: `pnpm exec vitest run`
Expected: FAIL — heading text is `App`; `./monitoring` not found.

- [ ] **Step 5: Implement**

`frontend/src/env.d.ts`:
```ts
interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_RELEASE?: string
}
```

`frontend/src/utils/monitoring.ts`:
```ts
// Imported lazily so the Sentry bundle never costs anything when no DSN is configured.
export async function initMonitoring(dsn = import.meta.env.VITE_SENTRY_DSN): Promise<void> {
  if (!dsn) return
  const Sentry = await import('@sentry/react')
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_RELEASE,
    sendDefaultPii: false,
  })
}
```

`frontend/src/App.tsx`:
```tsx
export default function App() {
  return (
    <main className="mx-auto max-w-content p-4">
      <h1 className="text-2xl font-bold">Language Journal</h1>
    </main>
  )
}
```

`frontend/src/main.tsx`:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App.tsx'
import { initMonitoring } from './utils/monitoring'

const root = document.getElementById('root')
if (!root) throw new Error('#root element missing from index.html')

void initMonitoring()

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

In `frontend/e2e/smoke.spec.ts`, after `await expect(heading).toBeVisible()` add:
```ts
  await expect(heading).toHaveText('Language Journal')
```

- [ ] **Step 6: Frontend CLAUDE.md**

`frontend/CLAUDE.md`:
```markdown
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
```

- [ ] **Step 7: Run the full frontend gate**

Run (inside `frontend/`): `pnpm verify`
Expected: ends with `ALL GATES GREEN` (Lighthouse included). Paste the tail into the task report.

- [ ] **Step 8: Commit and push**

```bash
cd ..
./scripts/check-hygiene.sh
git add -A
git commit -m "feat(frontend): port the agentic frontend kit and add lazy Sentry monitoring" -m "@sentry/react: frontend error reporting (spec §9), loaded only when VITE_SENTRY_DSN is set."
git push
```

---

### Task 5: Docker images and the full Compose stack

**Files:**
- Create: `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf`, `frontend/.dockerignore`, `scripts/wait-for-url.sh`
- Modify: `docker-compose.yml`

**Interfaces:**
- Consumes: `create_app` (Task 3), frontend build (Task 4).
- Produces: `docker compose up --build` serving the SPA on http://localhost:8080 (nginx proxies `/api/` and `/health` to the backend) and the API on http://localhost:8000. `scripts/wait-for-url.sh <url> [timeout_seconds]` for CI.

- [ ] **Step 1: Backend image**

`backend/Dockerfile` (build context is the repo root because of the uv workspace):
```dockerfile
FROM python:3.13-slim
COPY --from=ghcr.io/astral-sh/uv:0.12.0 /uv /usr/local/bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH=/opt/venv/bin:$PATH

WORKDIR /srv
COPY pyproject.toml uv.lock ./
COPY ai/pyproject.toml ai/pyproject.toml
COPY backend/pyproject.toml backend/pyproject.toml
RUN uv sync --frozen --no-dev --package journal-backend --no-install-workspace

COPY ai ai
COPY backend backend
RUN uv sync --frozen --no-dev --package journal-backend

RUN useradd --create-home --uid 10001 app
USER app
WORKDIR /srv/backend

ARG RELEASE=dev
ENV RELEASE=$RELEASE LOG_FORMAT=json
EXPOSE 8000
CMD ["uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
```

- [ ] **Step 2: Frontend image**

`frontend/.dockerignore`:
```
node_modules
dist
coverage
test-results
playwright-report
.lighthouse
```

`frontend/nginx.conf`:
```nginx
server {
  listen 80;
  root /usr/share/nginx/html;

  location /api/ {
    proxy_pass http://backend:8000;
    proxy_set_header X-Request-ID $request_id;
    # Analysis is synchronous and may take tens of seconds.
    proxy_read_timeout 120s;
  }

  location = /health {
    proxy_pass http://backend:8000;
  }

  location / {
    try_files $uri /index.html;
  }
}
```

`frontend/Dockerfile`:
```dockerfile
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG VITE_SENTRY_DSN=""
ARG VITE_RELEASE=dev
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN VITE_RELEASE=$VITE_RELEASE
RUN pnpm build

FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
```

- [ ] **Step 3: Compose services**

Replace `docker-compose.yml` with:
```yaml
x-backend: &backend
  build:
    context: .
    dockerfile: backend/Dockerfile
  env_file:
    - path: .env
      required: false
  environment:
    DATABASE_URL: postgresql+asyncpg://journal:journal@db:5432/journal
    CORS_ORIGINS: '["http://localhost:8080","http://localhost:5173"]'

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: journal
      POSTGRES_PASSWORD: journal
      POSTGRES_DB: journal
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./infra/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U journal -d journal"]
      interval: 2s
      timeout: 3s
      retries: 30

  migrate:
    <<: *backend
    command: ["alembic", "upgrade", "head"]
    depends_on:
      db:
        condition: service_healthy

  backend:
    <<: *backend
    ports:
      - "8000:8000"
    depends_on:
      migrate:
        condition: service_completed_successfully
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"]
      interval: 3s
      timeout: 3s
      retries: 20

  frontend:
    build: ./frontend
    ports:
      - "8080:80"
    depends_on:
      backend:
        condition: service_healthy

volumes:
  pgdata:
```

`scripts/wait-for-url.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
url="${1:?usage: wait-for-url.sh <url> [timeout_seconds]}"
timeout="${2:-120}"
for _ in $(seq "$timeout"); do
  curl -fsS "$url" >/dev/null 2>&1 && { echo "up: $url"; exit 0; }
  sleep 1
done
echo "timed out waiting for $url" >&2
exit 1
```

- [ ] **Step 4: Bring the stack up and verify**

Run:
```bash
chmod +x scripts/wait-for-url.sh
docker compose up -d --build
./scripts/wait-for-url.sh http://localhost:8080/health 180
curl -fsS http://localhost:8000/health
curl -fsS http://localhost:8080/ | grep -o '<title>Language Journal</title>'
docker compose logs backend | tail -3
docker compose down
```
Expected: `up: …`, `{"status":"ok","database":"up"}`, the title line, and JSON log lines containing `"request_id"`.

- [ ] **Step 5: Commit and push**

```bash
git add -A
git commit -m "build: Docker images and Compose stack (db, migrate, backend, nginx frontend)"
git push
```

---

### Task 6: Agent harness — instructions, rules, agents, hooks, skills

**Files:**
- Create: `CLAUDE.md`, `backend/CLAUDE.md`, `ai/CLAUDE.md`
- Create: `.claude/settings.json`, `.claude/hooks/post-edit.sh`, `.claude/hooks/stop-gate.sh`
- Create: `.claude/agents/{test-writer,reviewer,ui-qa}.md`, `.claude/agent-memory/{test-writer,reviewer,ui-qa}/MEMORY.md`
- Create: `.claude/rules/{backend,ai,python-tests,components,state,styling,tests}.md`
- Create: `.claude/skills/{component,design-system,testing,api-integration}/` (ported from the kit)

**Interfaces:**
- Consumes: Make targets (Task 1), frontend scripts (Task 4).
- Produces: hooks that lint/type-check each edited file and block completion while `make verify-fast` fails; agents used at every phase checkpoint from P1 on.

- [ ] **Step 1: Instruction files**

`CLAUDE.md`:
```markdown
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
```

`backend/CLAUDE.md`:
```markdown
# Backend rules (FastAPI)

- Layout: `app/core` (config, logging, request context, errors, sentry) · `app/db` (session, base, models) · `app/repositories` · `app/services` · `app/api` (deps, routes, schemas) · `migrations` · `tests/{unit,integration}`.
- Async throughout. Services own transactions (`await session.commit()`); repositories only add, flush and query.
- Routes take and return `app/api/schemas` models; never return ORM objects directly.
- Services raise `AppError` subclasses; handlers render problem+json. Never raise `HTTPException` from services.
- Schema change: edit models → `make revision m="…"` → read the generated migration before committing.
- Unit tests need no database. Integration tests use the `db_session` / `client` fixtures (rolled back per test) and the fake analyzer.
```

`ai/CLAUDE.md`:
```markdown
# journal_ai rules

- Pure package: text + language in, `AnalysisOutcome` out. No database, HTTP framework or backend imports.
- Providers implement `CompletionProvider`; the `FakeProvider` covers every failure mode in tests.
- Parsing raises only when the top-level output is unusable; a single bad mistake is dropped and counted.
- Changing prompt text → bump `PROMPT_VERSION` and run `make eval`.
```

- [ ] **Step 2: Settings and hooks**

`.claude/settings.json`:
```json
{
  "permissions": {
    "allow": [
      "Bash(make:*)",
      "Bash(uv run:*)",
      "Bash(uv sync:*)",
      "Bash(pnpm -C frontend:*)",
      "Bash(pnpm test)",
      "Bash(pnpm dev:*)",
      "Bash(pnpm lint:*)",
      "Bash(pnpm typecheck:*)",
      "Bash(pnpm verify:*)",
      "Bash(pnpm coverage:*)",
      "Bash(pnpm e2e:*)",
      "Bash(pnpm build:*)",
      "Bash(pnpm exec vitest run:*)",
      "Bash(pnpm exec playwright test:*)",
      "Bash(pnpm exec eslint:*)",
      "Bash(pnpm exec tsc:*)",
      "Bash(pnpm exec vite preview:*)",
      "Bash(docker compose:*)",
      "Bash(git status:*)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Bash(git show:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git push)",
      "Bash(git push origin main)",
      "Bash(mkdir -p docs/qa:*)",
      "Bash(agent-browser open:*)",
      "Bash(agent-browser snapshot:*)",
      "Bash(agent-browser click:*)",
      "Bash(agent-browser fill:*)",
      "Bash(agent-browser press:*)",
      "Bash(agent-browser wait:*)",
      "Bash(agent-browser errors:*)",
      "Bash(agent-browser console:*)",
      "Bash(agent-browser set viewport:*)",
      "Bash(agent-browser screenshot:*)",
      "Bash(agent-browser close:*)",
      "Bash(agent-browser get:*)",
      "Bash(agent-browser find:*)",
      "Bash(agent-browser skills get:*)"
    ],
    "ask": [
      "Bash(uv add:*)",
      "Bash(uv remove:*)",
      "Bash(pnpm add:*)",
      "Bash(pnpm remove:*)"
    ],
    "deny": [
      "Bash(git push --force:*)",
      "Bash(git push -f:*)",
      "Bash(cat .env)",
      "Read(./.env)",
      "Bash(agent-browser eval:*)"
    ]
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [{ "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/post-edit.sh" }]
      }
    ],
    "Stop": [
      {
        "hooks": [{ "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/stop-gate.sh" }]
      }
    ]
  }
}
```

`.claude/hooks/post-edit.sh`:
```bash
#!/usr/bin/env bash
# PostToolUse: check only the edited file (plus types for app code). Exit 2 feeds errors back to Claude.
# Read-only on purpose: auto-fixing would change files underneath the editor.
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}"
file="$(python3 -c 'import json,sys; print((json.load(sys.stdin).get("tool_input") or {}).get("file_path",""))' 2>/dev/null)"
rel="${file#"$PWD"/}"
fail() { echo "$1" | head -40 >&2; exit 2; }

case "$rel" in
  frontend/src/*.css)
    out="$(pnpm -s -C frontend exec stylelint "${rel#frontend/}" 2>&1)" || fail "$out" ;;
  frontend/src/*.ts|frontend/src/*.tsx|frontend/e2e/*.ts)
    out="$(pnpm -s -C frontend exec eslint "${rel#frontend/}" 2>&1)" || fail "$out"
    case "$rel" in *.test.ts|*.test.tsx|frontend/e2e/*) exit 0 ;; esac
    out="$(pnpm -s -C frontend typecheck:app 2>&1)" || fail "$out" ;;
  ai/*.py|backend/*.py)
    out="$(uv run --quiet ruff check "$rel" 2>&1 && uv run --quiet ruff format --check "$rel" 2>&1)" || fail "$out"
    case "$rel" in */tests/*|*/migrations/*|ai/evals/*) exit 0 ;; esac
    out="$(uv run --quiet mypy ai/journal_ai backend/app 2>&1)" || fail "$out" ;;
esac
exit 0
```

`.claude/hooks/stop-gate.sh`:
```bash
#!/usr/bin/env bash
# Stop: block "done" while lint or types are red. Never loops (stop_hook_active) and tolerates
# red-phase tests because the fast gate type-checks app code only.
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}"
active="$(python3 -c 'import json,sys; print(bool(json.load(sys.stdin).get("stop_hook_active")))' 2>/dev/null)"
[ "$active" = "True" ] && exit 0
out="$(make -s verify-fast 2>&1)" || { echo "Quality gate (make verify-fast) failed — fix before finishing:" >&2; echo "$out" | tail -40 >&2; exit 2; }
exit 0
```
Run: `chmod +x .claude/hooks/*.sh`

- [ ] **Step 3: Agents and memory**

`.claude/agents/test-writer.md`:
```markdown
---
name: test-writer
description: Writes failing tests for a plan task before its implementation exists. Use at the start of each task, with the plan path and task number.
tools: Read, Grep, Glob, Write, Edit, Bash
model: sonnet
memory: project
---
You write tests only — never implementation files. You may create or edit only `ai/tests/**`, `backend/tests/**`,
`frontend/src/**/*.test.ts(x)`, `frontend/e2e/*.spec.ts`, and MSW overrides inside test files.

Read your memory first, then the plan task you were given and the spec section it cites.

For each behaviour in the task:
1. Pick the lowest layer that proves it: pure function → unit; HTTP + DB → backend integration (`client`, `db_session` fixtures, fake analyzer); component states → Vitest + Testing Library + MSW; journeys → Playwright.
2. Name tests by behaviour (`test_failed_analysis_is_persisted_with_its_error_code`, `it('keeps the entry when analysis fails')`). Frontend tests use `// Arrange / // Act / // Assert`.
3. Run them (`uv run pytest <path>`, `pnpm -C frontend exec vitest run <file>`) and confirm each fails because the behaviour is missing, not because of a typo. A module the plan names that does not exist yet → stop and ask the main session to stub it.

Report (≤15 lines): `behaviour → test file::test name → fails because <reason>`. No code in the report.
Memory: add one line per reusable pattern (fixtures, fake provider scripts, MSW shapes, flake fixes).
```

`.claude/agents/reviewer.md`:
```markdown
---
name: reviewer
description: Unbiased review of a phase's diff against the spec, plan and project rules, in a fresh context. Use once at the end of each phase, or when the human asks. Read-only.
tools: Read, Grep, Glob, Bash
model: sonnet
memory: project
---
You review; you never edit. Only read-only commands (`git diff`, `git log`, `git show`, `make lint`, `make typecheck`).

Read your memory first. Scope: the commit range you are given (else the current phase's commits), the phase plan,
the spec, and the `CLAUDE.md` files.

Check, in order:
1. Correctness against the plan's tasks and the spec; the plan's Review Focus inputs are handled and tested.
2. Data safety: the entry is saved before analysis; failures are persisted; no double submit; transactions committed once, in services.
3. Boundaries: api → services → repositories → db; `journal_ai` stays pure; frontend data only through hooks.
4. AI handling: defensive parsing, retries bounded, raw response stored, no entry text in logs or Sentry.
5. Single source of truth: no duplicated state, derived data stored, or copy-pasted markup/logic.
6. A11y and responsiveness for UI changes (names, roles, keyboard, focus, live regions, 375px).
7. Tests: behaviour names, right layer, would fail if the logic broke.
8. Simplicity and comments: over-engineering, comments that restate code, dead code.

Triage hard. BLOCKING: a plan/spec requirement that fails, data loss or double-submit risk, a leaked secret or entry text,
a keyboard trap or unnamed control, a gate worked around. Else SHOULD (real defect, small fix) or NIT (taste).
At most 8 findings, most severe first; skip NITs unless fewer than 3 other findings. One pass.

Output: findings only, each `BLOCKING|SHOULD|NIT — file:line — problem — fix`. End with `VERDICT: CLEAN` or
`VERDICT: CHANGES REQUIRED`. No praise, no diff summary.
Memory: add one line per new recurring issue type.
```

`.claude/agents/ui-qa.md`:
```markdown
---
name: ui-qa
description: Verifies a phase's user-facing acceptance criteria in a real browser with agent-browser on desktop and mobile, with screenshots, keyboard, console and page-error checks. Use at UI phase checkpoints after make verify is green.
tools: Read, Grep, Glob, Bash
model: sonnet
memory: project
---
You test the running app like a user. You never edit source files.

0. Run `agent-browser skills get core` once per session and follow its patterns. Read your memory.
1. Test a built snapshot so concurrent edits can't disturb you: `pnpm -C frontend build --mode mock && pnpm -C frontend exec vite preview --port 4173 --strictPort` (background; mocks included, `?mock=slow|error|empty` work). Use http://localhost:4173; stop it at the end. `mkdir -p docs/qa`.
2. For each criterion in scope: clear `errors` and `console`, `snapshot`, act (`click`, `fill`, `press`), check the visible result.
3. Keyboard pass: Tab through controls, operate with Enter/Space/Escape; focus stays visible.
4. Mobile: `agent-browser set viewport 375 812`, repeat; no horizontal scroll.
5. After each criterion: `console` / `errors` — an error is a FAIL unless it is the expected one in a `?mock=error` state.
6. `agent-browser screenshot docs/qa/<phase>-<criterion>-<viewport>.png`; `agent-browser close`.

Report ONLY this table plus ≤5 lines of notes:
| criterion | desktop | mobile | keyboard | evidence |
FAIL rows include exact repro steps.
Memory: record reliable refs/roles and anything flaky, one line each.
```

Each `.claude/agent-memory/<name>/MEMORY.md` (three files, header changes per agent):
```markdown
# <name> memory

<!-- One line per learning: date — lesson. Keep under 50 lines; merge duplicates. -->
```

- [ ] **Step 4: Rules**

`.claude/rules/backend.md`:
```markdown
---
paths:
  - "backend/app/**"
  - "backend/migrations/**"
---
# Backend rules
- Layers: api → services → repositories → db. A route calls one service function; a service calls repositories and the analyzer.
- Repositories: queries only, typed returns, no commits, no business rules. One repository per aggregate.
- Services: own the transaction (`commit` once per use case), raise `AppError` subclasses, log one structured line per use case.
- Schemas: request/response models in `app/api/schemas`, `model_config = ConfigDict(from_attributes=True)` for ORM reads.
- New column or table → Alembic migration in the same commit; never edit an applied migration.
- Never log entry text, corrected text or mistakes; log ids, counts, timings.
```

`.claude/rules/ai.md`:
```markdown
---
paths:
  - "ai/**"
---
# journal_ai rules
- Provider-agnostic core: prompts, parsing, alignment and the analyzer never import a provider SDK; only `providers/anthropic.py` does.
- The entry is data: always wrapped in `<entry>` delimiters and stripped of delimiter look-alikes.
- Offsets are Unicode code-point indices into NFC-normalised text; highlights never overlap.
- Prompt changes bump `PROMPT_VERSION`; record eval results in the commit body.
```

`.claude/rules/python-tests.md`:
```markdown
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
```

Frontend rules: copy and re-scope the kit rules.
```bash
KIT="${KIT_DIR:?set KIT_DIR to the frontend starter kit}"
mkdir -p .claude/rules
for f in components state styling tests; do cp "$KIT/.claude/rules/$f.md" ".claude/rules/$f.md"; done
perl -pi -e 's#^  - "src/#  - "frontend/src/#; s#^  - "e2e/#  - "frontend/e2e/#' .claude/rules/{components,state,styling,tests}.md
perl -pi -e 's#Multi-page only \(plan says `Routing: multi`\)#Multi-page apps#; s#unless docs/plan.md calls for it#unless the phase plan calls for it#; s#\(only once the API recipe exists\)##; s# \(\+ MSW only with `Data: API`\)# (+ MSW)#' .claude/rules/*.md
grep -n 'docs/plan\|Data: API\|"src/' .claude/rules/*.md; echo "leftovers-exit=$?"
```
Expected: `leftovers-exit=1`.

- [ ] **Step 5: Skills**

```bash
KIT="${KIT_DIR:?set KIT_DIR to the frontend starter kit}"
mkdir -p .claude/skills
for s in component design-system testing api-integration; do cp -R "$KIT/.claude/skills/$s" .claude/skills/; done
perl -pi -e 's#(?<![\w/])src/#frontend/src/#g; s#(?<![\w/])e2e/#frontend/e2e/#g; s#docs/plan\.md says `Data: API`#the phase plan calls for the API layer#g; s#docs/plan\.md#the phase plan#g; s#plan says `Data: API`#phase plan calls for the API layer#g' .claude/skills/*/SKILL.md
grep -rnE 'docs/plan|docs/spec|Data: API|HANDOVER' .claude; echo "leftovers-exit=$?"
```
Expected: `leftovers-exit=1`. Read each `SKILL.md` once and fix any sentence the substitutions made awkward.

- [ ] **Step 6: Verify the hooks fire**

Run:
```bash
echo '{"tool_input":{"file_path":"'"$PWD"'/backend/app/main.py"}}' | .claude/hooks/post-edit.sh; echo "post-edit=$?"
echo '{"stop_hook_active":false}' | .claude/hooks/stop-gate.sh; echo "stop-gate=$?"
```
Expected: `post-edit=0`, `stop-gate=0`.

- [ ] **Step 7: Commit and push**

```bash
./scripts/check-hygiene.sh
git add -A
git commit -m "chore: agent harness — instructions, rules, agents, hooks and frontend skills"
git push
```

---

### Task 7: CI pipeline

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: every Make target and script above.
- Produces: required checks `hygiene`, `ai`, `backend`, `frontend`, `e2e-stack` on every push and pull request. P1 extends `ai`; P3 extends `e2e-stack` with Playwright.

- [ ] **Step 1: Workflow**

`.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  hygiene:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: ./scripts/check-hygiene.sh

  ai:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v6
        with:
          enable-cache: true
      - run: uv sync --all-packages --frozen
      - run: uv run ruff check ai && uv run ruff format --check ai
      - run: uv run mypy ai/journal_ai
      - run: uv run pytest ai

  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: journal
          POSTGRES_PASSWORD: journal
          POSTGRES_DB: journal
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U journal -d journal"
          --health-interval 2s --health-timeout 3s --health-retries 30
    env:
      DATABASE_URL: postgresql+asyncpg://journal:journal@localhost:5432/journal
      TEST_DATABASE_URL: postgresql+asyncpg://journal:journal@localhost:5432/journal_test
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v6
        with:
          enable-cache: true
      - run: uv sync --all-packages --frozen
      - run: PGPASSWORD=journal psql -h localhost -U journal -d journal -c 'CREATE DATABASE journal_test'
      - run: uv run ruff check backend && uv run ruff format --check backend
      - run: uv run mypy backend/app
      - run: cd backend && uv run lint-imports
      - run: cd backend && uv run alembic upgrade head && uv run alembic check
      - run: make test-backend

  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          package_json_file: frontend/package.json
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
          cache-dependency-path: frontend/pnpm-lock.yaml
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm verify

  e2e-stack:
    needs: [backend, frontend]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker compose up -d --build
      - run: ./scripts/wait-for-url.sh http://localhost:8080/health 240
      - run: curl -fsS http://localhost:8000/health
      - run: curl -fsS http://localhost:8080/ | grep -q '<title>Language Journal</title>'
      - if: failure()
        run: docker compose logs
      - if: always()
        run: docker compose down -v
```

- [ ] **Step 2: Validate locally, commit, push, watch**

Run: `make verify` (Postgres must be up: `make db`)
Expected: hygiene clean, lint/type clean, tests green, frontend `ALL GATES GREEN`.
```bash
git add -A
git commit -m "ci: hygiene, ai, backend, frontend and full-stack jobs"
git push
gh run watch --exit-status "$(gh run list --limit 1 --json databaseId -q '.[0].databaseId')"
```
Expected: all five jobs green. If one fails, fix the cause (never the gate), commit, push, re-watch.

- [ ] **Step 3: Phase checkpoint**

Dispatch the `reviewer` agent on the P0 commit range. Fix BLOCKING findings, log the rest in the P1 plan's notes, mark P0 `done` in `docs/superpowers/plans/2026-10-10-00-index.md`, commit `docs: mark P0 done`, push.

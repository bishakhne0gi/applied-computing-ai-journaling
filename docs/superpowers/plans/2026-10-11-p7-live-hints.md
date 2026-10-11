# P7 Live Hints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quiet live hints while writing — after a pause the composer underlines likely mistakes from a fast model, one click (or Enter) accepts a correction through the textarea's editing API so ⌘/Ctrl+Z undoes it — while the saved, full analysis on submit stays the only source of history and insights.

**Architecture:** `journal_ai.Analyzer` gains `max_attempts` so the backend can build a second, single-attempt analyzer on `AI_LIVE_MODEL` (effort `low`, short timeout, no tracing). A new `POST /api/v1/check` route calls `LiveCheckService`, which runs that analyzer on unsaved text, stores nothing, logs metadata only and answers 503 problem+json when the model cannot. The frontend debounces the composer text (1.2 s, ≥ 3 words), fetches hints through a TanStack query keyed by text (aborts stale requests, newest wins), re-anchors them to the text the writer has typed since, and renders them as underline decorations in P6's `HighlightedTextarea` backdrop, with a caret-click popover (Accept/Dismiss) and an accessible hint list behind a "Live hints" switch.

**Tech Stack:** Python 3.13, FastAPI, Pydantic v2, structlog, pytest (FakeProvider, real Postgres for integration) · React 19, TypeScript 6, TanStack Query 5.104 (`skipToken`, `keepPreviousData`, query `signal`), ky 2.1 (`signal`), MSW 2.15, Vitest + Testing Library, Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-10-11-p6-workspace-redesign.md` §7.2 (amends main spec §2 "Feedback timing"). Builds on P6 (`docs/superpowers/plans/2026-10-11-p6-workspace.md`): `HighlightedTextarea`, `Decoration`, `decorate`, `CHIP_CLASS`, `bracketRanges`, `EntryTextField`, `EntryForm`, `Correction`, `markClasses`, `useLocalStorage`. Interfaces consumed are the real code on `main` after P6.

## Global Constraints

- **Start only after P6 is marked done** in `docs/superpowers/plans/2026-10-10-00-index.md`.
- `make verify` (needs `make db`) ends with `ALL GATES GREEN` at the end of **every** task; `make e2e-stack` runs in Tasks 7 and 8. Thresholds unchanged (backend coverage floor 85%, Vitest band 65–85%, Lighthouse desktop 100 / mobile ≥ 90, ESLint size limits, mypy strict, import-linter contracts).
- **No new dependency** in any package.
- Privacy (root `CLAUDE.md`, main spec §9): live-check text is never logged, never sent to Sentry or Langfuse, never stored. The service logs language, model, latency, hint count and failure code only; on an unexpected exception it logs the exception class name only and re-raises nothing that carries the message. Live checks are **not traced** (they fire on every pause; tracing them would multiply Langfuse volume for calls nobody stores).
- Live hints never count toward insights: `/check` writes no row, and only submitted analyses feed `/insights`.
- Same limits as entries: 1–5000 code points after trimming; supported languages only (422 otherwise).
- `/check` answers `200` with hints, or `503` problem+json (`title: "Service Unavailable"`) when the live model fails, times out, returns unusable output or the analyzer crashes. The UI hides hints silently on any error.
- Defaults: `AI_LIVE_MODEL=claude-haiku-5-5` (from the spec; verify the id against the account in Task 8 Step 3), effort `low`, `AI_LIVE_TIMEOUT_SECONDS=8`, one attempt (a hint that needs a retry is already stale). Demo mode (`AI_PROVIDER=fake`) serves the FakeProvider's deterministic rules as hints.
- Frontend: debounce 1.2 s, ≥ 3 words, newest response wins (TanStack cancels the superseded query through its `signal`); dismissed hints stay dismissed for the composer session; hints re-anchor by their `original` text nearest the old place (UTF-16, ≤ 80 characters away) or are dropped; underlines are decorative (`aria-hidden` backdrop) and the hint list is the accessible path; the switch is remembered in `localStorage` (`journal.liveHints`, default on).
- Accept edits through `document.execCommand('insertText')` (lands in the native undo stack), falling back to `setRangeText` + an `input` event where that is unavailable (jsdom).
- Hard limits, boundaries, styling, test style and commit rules exactly as in the P6 plan's Global Constraints (file ≤ 200 lines, function ≤ 60, complexity ≤ 10; features reach data only through `hooks/queries|mutations`; tokens only, every button is `<Button>`; AAA + behaviour names; plain commits as `bishakhne0gi`, no AI attribution, explicit `git add`, never stage `.github/`, never read the real env file; no `git push` inside a task).
- Python: behaviour-named tests, `FakeProvider` only, Postgres for integration, one structured log line per use case, services raise `AppError` subclasses.

## Review Focus

- The writer keeps typing while a check is in flight → the late response never overwrites hints for newer text, and hints already shown move with the text or disappear. (Task 4 `useCheckQuery` abort/newest test; Task 5 re-anchor table.)
- A hint on `[park]` arrives while the chip is showing → one decoration with both chip tint and vocab underline, not one hiding the other; accepting it replaces the bracketed English with the target word. (Task 5 `editorDecorations` merge test; Task 6 accept test.)
- Accepting a hint, then pressing ⌘/Ctrl+Z → the original text returns. (Task 7 e2e in Chromium; jsdom cannot run `execCommand`.)
- The live model is down, slow or the key lacks access to `AI_LIVE_MODEL` → 503, no hint UI, no alert, writing and "Get feedback" unaffected. (Task 3 503 table; Task 6 "unavailable" test.)
- Entry text reaching logs or Sentry from `/check`, including the crash path whose exception message carries the text → never. (Task 3 privacy tests.)

## File map

```
ai/journal_ai/analyzer.py · ai/tests/test_analyzer.py                                         (T1)
backend/
  app/core/config.py · app/main.py · tests/conftest.py · tests/unit/{test_config,test_app_lifecycle}.py   (T2)
  app/core/errors.py · app/services/live_check.py (new) · app/api/schemas/check.py (new)
  app/api/routes/check.py (new) · app/api/deps.py · app/api/v1.py
  tests/integration/{conftest.py, test_check_api.py (new)}                                     (T3)
.env.example                                                                                   (T2)
frontend/src/
  types/check.ts (new) · utils/{endpoints,constants}.ts
  hooks/queries/{journalKeys.ts, useCheckQuery.ts (new, +test)} · hooks/misc/useDebouncedValue.ts (new, +test)
  mocks/{check.ts (new, +test), handlers.ts}                                                   (T4)
  features/feedback/markClasses.ts · features/live-hints/{reanchor,editorDecorations,applyHint}.ts (new, +tests)  (T5)
  components/ui/HighlightedTextarea/{decorate.ts, HighlightedTextarea.tsx} (decoration ids) · components/ui/Switch (new)
  features/live-hints/{useLiveHints.ts, useLiveHintsSetting.ts, HintPopover.tsx, HintList.tsx, LiveHintsControls.tsx} (new)
  features/editor/EntryTextField.tsx · features/write/{ComposerEditor.tsx (new, +tests), EntryForm.tsx}  (T6)
frontend/e2e/live-hints.spec.ts (new) · frontend/e2e-stack/live-hints.spec.ts (new)            (T7)
README.md · main spec §2/§5/§7 · docs/loom-outline.md · frontend/DESIGN.md · plans index · docs/qa/p7-*.png   (T8)
```

Tasks: 1 single-attempt analyzer · 2 live analyzer settings and wiring · 3 `/check` route, service, 503 and privacy · 4 frontend data layer (query, debounce, mock) · 5 re-anchoring, decorations, accept · 6 composer UI (underlines, popover, hint list, switch) · 7 e2e (mock + full stack) · 8 docs + checkpoint.

---

### Task 1: A single-attempt analyzer

**Files:**
- Modify: `ai/journal_ai/analyzer.py`, `ai/tests/test_analyzer.py`

**Interfaces:**
- Consumes: `FakeProvider(script)`, `FailureCode`.
- Produces: `Analyzer(provider: CompletionProvider, tracer: Tracer | None = None, *, max_attempts: int = MAX_ATTEMPTS)`; `max_attempts < 1` raises `ValueError("max_attempts must be at least 1")`. Default behaviour unchanged (2 attempts).

- [ ] **Step 1: Write the failing tests**

Append to `ai/tests/test_analyzer.py`:
```python
async def test_a_single_attempt_analyzer_does_not_retry_unusable_output() -> None:
    provider = FakeProvider(["not json", _valid()])

    outcome = await Analyzer(provider, max_attempts=1).analyze(TEXT, "es")

    assert outcome.failure is FailureCode.INVALID_OUTPUT
    assert outcome.retried is False
    assert len(provider.calls) == 1


def test_max_attempts_below_one_is_rejected() -> None:
    with pytest.raises(ValueError, match="at least 1"):
        Analyzer(FakeProvider([]), max_attempts=0)


async def test_the_demo_provider_answers_a_single_attempt_check_without_a_key() -> None:
    text = "Hoy yo es feliz con la problema."

    outcome = await Analyzer(FakeProvider(), max_attempts=1).analyze(text, "es")

    assert outcome.result is not None
    spans = {(m.original, text[m.start : m.end]) for m in outcome.result.mistakes if m.start is not None and m.end is not None}
    assert spans == {("yo es", "yo es"), ("la problema", "la problema")}
```

- [ ] **Step 2: Run them to verify they fail**

Run: `uv run --package journal-ai pytest ai/tests/test_analyzer.py -q`
Expected: FAIL — `TypeError: Analyzer.__init__() got an unexpected keyword argument 'max_attempts'`.

- [ ] **Step 3: Implement**

`ai/journal_ai/analyzer.py`:
```python
class Analyzer:
    def __init__(
        self, provider: CompletionProvider, tracer: Tracer | None = None, *, max_attempts: int = MAX_ATTEMPTS
    ) -> None:
        if max_attempts < 1:
            raise ValueError("max_attempts must be at least 1")
        self._provider = provider
        self._tracer: Tracer = tracer or NoopTracer()
        # Live checks use one attempt: by the time a retry returned, the writer has typed on.
        self._max_attempts = max_attempts
```
and in `_run`: `while run.attempts < self._max_attempts:`.

- [ ] **Step 4: Run the AI gate**

Run: `make test-ai` then `make verify-fast`
Expected: all AI tests pass (previous count + 3); lint and types clean.

- [ ] **Step 5: Commit**

```bash
git add ai/journal_ai/analyzer.py ai/tests/test_analyzer.py
git commit -m "feat(ai): single-attempt analyzer for live checks"
```

---

### Task 2: Live analyzer settings and wiring

**Files:**
- Modify: `backend/app/core/config.py`, `backend/app/main.py`, `backend/tests/conftest.py`, `backend/tests/unit/test_config.py`, `backend/tests/unit/test_app_lifecycle.py`, `.env.example`

**Interfaces:**
- Consumes: `Analyzer(..., max_attempts=1)` (Task 1), `build_provider`.
- Produces: `Settings.ai_live_model: str = "claude-haiku-5-5"`, `Settings.ai_live_timeout_seconds: float = 8.0`; `app.state.live_analyzer` (single attempt, effort `low`, no tracer), closed on shutdown after the main analyzer and before the engine; `app.main._build_live_analyzer(settings) -> Analyzer`.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/unit/test_config.py`:
```python
def test_live_hints_default_to_a_fast_model_with_a_short_timeout() -> None:
    settings = Settings(_env_file=None)

    assert settings.ai_live_model == "claude-haiku-5-5"
    assert settings.ai_live_timeout_seconds == 8.0


def test_the_live_model_can_be_overridden(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AI_LIVE_MODEL", "claude-other")
    monkeypatch.setenv("AI_LIVE_TIMEOUT_SECONDS", "5")

    settings = Settings(_env_file=None)

    assert settings.ai_live_model == "claude-other"
    assert settings.ai_live_timeout_seconds == 5.0
```

Append to `backend/tests/unit/test_app_lifecycle.py`:
```python
def test_the_live_analyzer_uses_the_live_model_at_low_effort_with_its_own_timeout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict[str, Any]] = []
    real_build_provider = main.build_provider

    def spy(name: Any, **kwargs: Any) -> Any:
        calls.append(kwargs)
        return real_build_provider(name, **kwargs)

    monkeypatch.setattr(main, "build_provider", spy)

    main.create_app(Settings(_env_file=None, ai_live_model="m-live", ai_live_timeout_seconds=5))

    live = [c for c in calls if c["model"] == "m-live"]
    assert live == [{**live[0], "effort": "low", "timeout_seconds": 5}]


async def test_shutdown_closes_both_analyzers_before_the_engine(
    settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[str] = []
    _record_engine(monkeypatch, calls)
    app = main.create_app(settings)
    app.state.analyzer = _OrderedAnalyzer(calls)
    app.state.live_analyzer = _NamedAnalyzer(calls, "live.aclose")

    async with app.router.lifespan_context(app):
        pass

    assert calls == ["analyzer.aclose", "live.aclose", "engine.dispose"]
```
with, next to `_OrderedAnalyzer`:
```python
class _NamedAnalyzer:
    def __init__(self, calls: list[str], name: str) -> None:
        self._calls = calls
        self._name = name

    async def aclose(self) -> None:
        self._calls.append(self._name)
```

`backend/tests/conftest.py` — add `"AI_LIVE_MODEL"` and `"AI_LIVE_TIMEOUT_SECONDS"` to `_SETTINGS_ENV_VARS`.

- [ ] **Step 2: Run them to verify they fail**

Run: `uv run --package journal-backend pytest backend/tests/unit -q`
Expected: FAIL — `Settings` has no `ai_live_model`; no `live.aclose` call.

- [ ] **Step 3: Implement**

`backend/app/core/config.py` — after `ai_timeout_seconds`:
```python
    # Live hints (POST /check): a fast model, one attempt, a short timeout; nothing is stored.
    ai_live_model: str = "claude-haiku-5-5"
    ai_live_timeout_seconds: float = 8.0
```

`backend/app/main.py`:
```python
def _api_key(settings: Settings) -> str | None:
    return settings.anthropic_api_key.get_secret_value() if settings.anthropic_api_key else None


def _build_analyzer(settings: Settings) -> Analyzer:
    provider = build_provider(
        settings.resolved_ai_provider,
        api_key=_api_key(settings),
        model=settings.ai_model,
        effort=settings.ai_effort,
        timeout_seconds=settings.ai_timeout_seconds,
        workspace_id=settings.anthropic_workspace_id,
    )
    …tracer unchanged…
    return Analyzer(provider, tracer)


def _build_live_analyzer(settings: Settings) -> Analyzer:
    provider = build_provider(
        settings.resolved_ai_provider,
        api_key=_api_key(settings),
        model=settings.ai_live_model,
        effort="low",
        timeout_seconds=settings.ai_live_timeout_seconds,
        workspace_id=settings.anthropic_workspace_id,
    )
    # Untraced: checks fire on every pause, and tracing calls nobody stores would multiply Langfuse volume.
    return Analyzer(provider, max_attempts=1)
```
Lifespan `finally` block:
```python
        finally:
            # Closes both providers' pooled HTTP clients and flushes queued traces before the process exits.
            try:
                await app.state.analyzer.aclose()
            finally:
                try:
                    await app.state.live_analyzer.aclose()
                finally:
                    await engine.dispose()
```
and in `create_app`: `app.state.live_analyzer = _build_live_analyzer(settings)` after `app.state.analyzer = …`.

`.env.example` — after `AI_TIMEOUT_SECONDS=30`:
```
# Live hints while writing (POST /api/v1/check): fast model, effort low, one attempt, nothing stored or traced.
AI_LIVE_MODEL=claude-haiku-5-5
AI_LIVE_TIMEOUT_SECONDS=8
```

- [ ] **Step 4: Run the backend gate**

Run: `make test-backend` then `make verify-fast`
Expected: all backend tests pass (coverage ≥ 85%); ruff, mypy, import-linter clean.

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/config.py backend/app/main.py backend/tests .env.example
git commit -m "feat(backend): live analyzer on AI_LIVE_MODEL, closed on shutdown"
```

---

### Task 3: `POST /api/v1/check` — service, schemas, 503 and privacy

**Files:**
- Create: `backend/app/services/live_check.py`, `backend/app/api/schemas/check.py`, `backend/app/api/routes/check.py`, `backend/tests/integration/test_check_api.py`
- Modify: `backend/app/core/errors.py`, `backend/app/api/deps.py`, `backend/app/api/v1.py`, `backend/tests/integration/conftest.py`, `backend/tests/support.py`

**Interfaces:**
- Consumes: `AnalyzerPort` (`app.services.analyses`), `LanguageCode`, `EntryText` (`app.api.schemas.entries`), `app.state.live_analyzer` (Task 2).
- Produces:
  - `ServiceUnavailableError(AppError)` — 503, title "Service Unavailable".
  - `LiveCheck(analyzed_text: str, mistakes: tuple[AlignedMistake, ...])`, `LiveCheckService(analyzer).check(text, language) -> LiveCheck`.
  - `CheckRequest{language, text}` → `CheckOut{analyzed_text: str, hints: list[HintOut]}`, `HintOut{kind, category, original, correction, explanation, start: int | None, end: int | None}` (code points into `analyzed_text`, like analyses).
  - `get_live_analyzer`, `LiveCheckServiceDep` in `app.api.deps`.
  - Test factory `make_live_api(script | analyzer)` in the integration conftest.

- [ ] **Step 1: Write the failing tests**

`backend/tests/support.py` — extend the protocol file:
```python
class LiveApiFactory(Protocol):
    def __call__(
        self, script: Sequence[str | Exception] | None = None, *, analyzer: object | None = None
    ) -> AbstractAsyncContextManager[AsyncClient]: ...
```

`backend/tests/integration/conftest.py` — add (imports: `get_live_analyzer`, `LiveApiFactory`):
```python
@pytest.fixture
def make_live_api(settings: Settings, db_session: AsyncSession, make_client: ClientFactory) -> LiveApiFactory:
    @asynccontextmanager
    async def factory(
        script: Sequence[str | Exception] | None = None, *, analyzer: object | None = None
    ) -> AsyncIterator[AsyncClient]:
        app = create_app(settings)
        app.dependency_overrides[get_session] = lambda: db_session
        live = analyzer or Analyzer(FakeProvider(script), max_attempts=1)
        app.dependency_overrides[get_live_analyzer] = lambda: live
        async with make_client(app) as client:
            yield client

    return factory
```

`backend/tests/integration/test_check_api.py`:
```python
from typing import Any

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from structlog.testing import capture_logs

from app.db.models import Analysis, Entry
from journal_ai.providers.base import ProviderError, ProviderTimeoutError
from tests.support import YO_ES, LiveApiFactory, model_reply

SECRET = "Ayer yo es feliz con Maribel."


def _check(text: str = "Ayer yo es feliz.", language: str = "es") -> dict[str, str]:
    return {"language": language, "text": text}


async def test_check_returns_hints_with_code_point_offsets(make_live_api: LiveApiFactory) -> None:
    async with make_live_api([model_reply(YO_ES)]) as client:
        response = await client.post("/api/v1/check", json=_check())

    body = response.json()
    assert response.status_code == 200
    assert body["analyzed_text"] == "Ayer yo es feliz."
    assert body["hints"] == [{**YO_ES, "start": 5, "end": 10}]
    assert "raw_response" not in body


async def test_check_stores_nothing(make_live_api: LiveApiFactory, db_session: AsyncSession) -> None:
    async with make_live_api([model_reply(YO_ES)]) as client:
        await client.post("/api/v1/check", json=_check())

    entries = await db_session.scalar(select(func.count()).select_from(Entry))
    analyses = await db_session.scalar(select(func.count()).select_from(Analysis))
    assert (entries, analyses) == (0, 0)


async def test_the_demo_provider_serves_hints_without_a_key(make_live_api: LiveApiFactory) -> None:
    async with make_live_api() as client:
        response = await client.post("/api/v1/check", json=_check("Hoy yo es feliz."))

    assert [hint["original"] for hint in response.json()["hints"]] == ["yo es"]


@pytest.mark.parametrize(
    "body",
    [_check(language="xx"), _check(text="   "), _check(text="a" * 5001), {"text": "Hola"}],
    ids=["unsupported language", "blank text", "over the limit", "no language"],
)
async def test_invalid_requests_are_422(make_live_api: LiveApiFactory, body: dict[str, Any]) -> None:
    async with make_live_api([]) as client:
        response = await client.post("/api/v1/check", json=body)

    assert response.status_code == 422


@pytest.mark.parametrize(
    "step",
    [ProviderError("down"), ProviderTimeoutError("slow"), "not json"],
    ids=["provider error", "timeout", "unusable output"],
)
async def test_an_unavailable_live_model_is_503_problem_json(
    make_live_api: LiveApiFactory, step: str | Exception
) -> None:
    async with make_live_api([step]) as client:
        response = await client.post("/api/v1/check", json=_check())

    assert response.status_code == 503
    assert response.headers["content-type"].startswith("application/problem+json")
    assert response.json()["title"] == "Service Unavailable"


class _CrashingAnalyzer:
    async def analyze(self, text: str, language: str) -> Any:
        raise RuntimeError(f"leaked {text}")


async def test_a_crashing_analyzer_is_503_and_logs_only_the_exception_type(make_live_api: LiveApiFactory) -> None:
    with capture_logs() as logs:
        async with make_live_api(analyzer=_CrashingAnalyzer()) as client:
            response = await client.post("/api/v1/check", json=_check(SECRET))

    assert response.status_code == 503
    assert SECRET not in response.text
    assert any(log.get("exception_type") == "RuntimeError" for log in logs)
    assert all(SECRET not in str(log) and "Maribel" not in str(log) for log in logs)


@pytest.mark.parametrize("script", [[model_reply(YO_ES)], [ProviderError("down")]], ids=["success", "failure"])
async def test_live_checks_never_log_or_report_the_text(
    make_live_api: LiveApiFactory, monkeypatch: pytest.MonkeyPatch, script: list[str | Exception]
) -> None:
    reported: list[Any] = []
    monkeypatch.setattr("sentry_sdk.capture_message", lambda *a, **k: reported.append((a, k)))
    monkeypatch.setattr("sentry_sdk.capture_exception", lambda *a, **k: reported.append((a, k)))
    with capture_logs() as logs:
        async with make_live_api(script) as client:
            await client.post("/api/v1/check", json=_check(SECRET))

    assert reported == []
    assert any(log["event"].startswith("live_check") for log in logs)
    assert all("Maribel" not in str(log) for log in logs)
```

- [ ] **Step 2: Run them to verify they fail**

Run: `uv run --package journal-backend pytest backend/tests/integration/test_check_api.py -q` (needs `make db`)
Expected: FAIL — `ImportError: cannot import name 'get_live_analyzer'`.

- [ ] **Step 3: Implement**

`backend/app/core/errors.py` — after `NotFoundError`:
```python
class ServiceUnavailableError(AppError):
    status_code = HTTPStatus.SERVICE_UNAVAILABLE
    title = "Service Unavailable"
```

`backend/app/services/live_check.py`:
```python
from dataclasses import dataclass

import structlog

from app.core.errors import ServiceUnavailableError
from app.services.analyses import AnalyzerPort
from journal_ai import AlignedMistake

logger = structlog.get_logger()

UNAVAILABLE = "Live hints are unavailable right now"


@dataclass(frozen=True)
class LiveCheck:
    analyzed_text: str
    mistakes: tuple[AlignedMistake, ...]


# Hints for text that is not saved yet: nothing is stored, nothing reaches insights, and the text never reaches a
# log line — exception messages included, since a provider error can quote the prompt.
class LiveCheckService:
    def __init__(self, analyzer: AnalyzerPort) -> None:
        self._analyzer = analyzer

    async def check(self, text: str, language: str) -> LiveCheck:
        try:
            outcome = await self._analyzer.analyze(text, language)
        except Exception as exc:
            logger.warning("live_check_crashed", language=language, exception_type=type(exc).__name__)
            raise ServiceUnavailableError(UNAVAILABLE) from None
        logger.info(
            "live_check_completed",
            language=language,
            model=outcome.model,
            latency_ms=outcome.latency_ms,
            hints=len(outcome.result.mistakes) if outcome.result else 0,
            error_code=outcome.failure.value if outcome.failure else None,
        )
        if outcome.result is None:
            raise ServiceUnavailableError(UNAVAILABLE)
        return LiveCheck(analyzed_text=outcome.analyzed_text, mistakes=outcome.result.mistakes)
```

`backend/app/api/schemas/check.py`:
```python
from pydantic import BaseModel, ConfigDict

from app.api.schemas.entries import EntryText, LanguageCode
from journal_ai import Category, MistakeKind


class CheckRequest(BaseModel):
    language: LanguageCode
    text: EntryText


class HintOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    kind: MistakeKind
    category: Category
    original: str
    correction: str
    explanation: str
    start: int | None
    end: int | None


class CheckOut(BaseModel):
    # Offsets are code points into this text (normalised like an analysis), not into what the client sent.
    analyzed_text: str
    hints: list[HintOut]
```

`backend/app/api/routes/check.py`:
```python
from fastapi import APIRouter

from app.api.deps import LiveCheckServiceDep
from app.api.schemas.check import CheckOut, CheckRequest, HintOut

router = APIRouter(tags=["check"])


@router.post("/check", response_model=CheckOut)
async def check_text(body: CheckRequest, service: LiveCheckServiceDep) -> CheckOut:
    # 200, not 201: nothing is created. 503 when the live model cannot answer; the client then hides hints quietly.
    result = await service.check(body.text, body.language)
    return CheckOut(analyzed_text=result.analyzed_text, hints=[HintOut.model_validate(m) for m in result.mistakes])
```

`backend/app/api/deps.py` — add:
```python
from app.services.live_check import LiveCheckService
…
def get_live_analyzer(request: Request) -> AnalyzerPort:
    return cast(AnalyzerPort, request.app.state.live_analyzer)


def get_live_check_service(analyzer: Annotated[AnalyzerPort, Depends(get_live_analyzer)]) -> LiveCheckService:
    return LiveCheckService(analyzer)


LiveCheckServiceDep = Annotated[LiveCheckService, Depends(get_live_check_service)]
```

`backend/app/api/v1.py`: `from app.api.routes import analyses, check, entries, insights, languages` and `api_router.include_router(check.router)`.

- [ ] **Step 4: Run the backend gate**

Run: `make test-backend` then `make verify-fast`
Expected: all pass, coverage ≥ 85%; import-linter still green (`app.services.live_check` imports only `app.core`, `app.services.analyses`, `journal_ai`).

- [ ] **Step 5: Commit**

```bash
git add backend/app backend/tests
git commit -m "feat(backend): POST /check for live hints — nothing stored, metadata-only logs, 503 when unavailable"
```

---
### Task 4: Frontend data layer — check query, debounce, in-memory `/check`

**Files:**
- Create: `frontend/src/types/check.ts`, `frontend/src/hooks/queries/{useCheckQuery.ts,useCheckQuery.test.tsx}`, `frontend/src/hooks/misc/{useDebouncedValue.ts,useDebouncedValue.test.ts}`, `frontend/src/mocks/{check.ts,check.test.ts}`
- Modify: `frontend/src/utils/{endpoints.ts,constants.ts}`, `frontend/src/hooks/queries/journalKeys.ts`, `frontend/src/mocks/handlers.ts`, `frontend/CLAUDE.md` (mock modes line)

**Interfaces:**
- Consumes: `client`, `ENDPOINTS`, `analyzeText` (mock analyzer), `cleanText`/`cleanLanguage`/`invalid`/`problem` (mock responses).
- Produces:
  - `CheckRequest { language: string; text: string }`, `HintOut = Omit<MistakeOut, 'id'>`, `CheckOut { analyzed_text: string; hints: HintOut[] }`.
  - `ENDPOINTS.check = 'check'`; `journalKeys.check(request: CheckRequest | null)`.
  - `useCheckQuery(request: CheckRequest | null)` — `skipToken` when null; `placeholderData: keepPreviousData`; `retry: false`; `staleTime: Infinity`; aborts superseded requests.
  - `useDebouncedValue<T>(value: T, delayMs: number): T` — starts at the current value (text already in the editor is checked at once).
  - `STORAGE_KEYS.liveHints = 'journal.liveHints'`, `LIVE_HINTS = { debounceMs: 1200, minWords: 3 }`.
  - Mock `POST /check` (same rules as mock analyses, nothing stored) and mode `?mock=check-unavailable` (503).

- [ ] **Step 1: Write the failing tests**

`frontend/src/hooks/misc/useDebouncedValue.test.ts`:
```ts
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedValue } from './useDebouncedValue'

describe('useDebouncedValue', () => {
  afterEach(() => vi.useRealTimers())

  it('starts at the current value, so text already there is checked at once', () => {
    // Arrange + Act
    const { result } = renderHook(() => useDebouncedValue('Hola', 1200))
    // Assert
    expect(result.current).toBe('Hola')
  })

  it('follows the value only once it has stopped changing for the delay', () => {
    // Arrange
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 1200), { initialProps: { value: 'a' } })
    // Act
    rerender({ value: 'ab' })
    act(() => vi.advanceTimersByTime(1000))
    rerender({ value: 'abc' })
    act(() => vi.advanceTimersByTime(1000))
    const midway = result.current
    act(() => vi.advanceTimersByTime(200))
    // Assert
    expect(midway).toBe('a')
    expect(result.current).toBe('abc')
  })
})
```

`frontend/src/hooks/queries/useCheckQuery.test.tsx`:
```tsx
import { waitFor } from '@testing-library/react'
import { delay, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { apiUrl } from '@/test/helpers'
import { renderHookWithProviders } from '@/test/renderWithProviders'
import { server } from '@/test/server'
import { ENDPOINTS } from '@/utils/endpoints'
import { useCheckQuery } from './useCheckQuery'

describe('useCheckQuery', () => {
  it('returns hints with offsets for the text it is given', async () => {
    // Arrange + Act
    const { result } = renderHookWithProviders(() => useCheckQuery({ language: 'es', text: 'Hoy yo es feliz.' }))
    // Assert
    await waitFor(() => expect(result.current.data?.hints).toEqual([expect.objectContaining({ original: 'yo es', start: 4, end: 9 })]))
  })

  it('sends nothing without a request', async () => {
    // Arrange
    let requests = 0
    server.use(
      http.post(apiUrl(ENDPOINTS.check), () => {
        requests += 1
      }),
    )
    // Act
    const { result } = renderHookWithProviders(() => useCheckQuery(null))
    await delay(50)
    // Assert
    expect(requests).toBe(0)
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('aborts a superseded check so only the newest text answers', async () => {
    // Arrange
    const aborted: string[] = []
    server.use(
      http.post(apiUrl(ENDPOINTS.check), async ({ request }) => {
        const { text } = (await request.clone().json()) as { text: string }
        request.signal.addEventListener('abort', () => aborted.push(text))
        await delay(100)
      }),
    )
    let text = 'Hoy yo es feliz.'
    const { result, rerender } = renderHookWithProviders(() => useCheckQuery({ language: 'es', text }))
    // Act
    text = 'Hoy yo soy feliz.'
    rerender()
    // Assert
    await waitFor(() => expect(result.current.data?.analyzed_text).toBe('Hoy yo soy feliz.'))
    expect(aborted).toEqual(['Hoy yo es feliz.'])
  })
})
```

`frontend/src/mocks/check.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { check, checkText } from './check'

describe('mock /check', () => {
  it('returns hints whose code-point offsets point at their words', () => {
    // Arrange
    const text = 'Hoy 😀 yo es feliz en el [park].'
    // Act
    const { analyzed_text, hints } = checkText(text)
    // Assert
    const chars = Array.from(analyzed_text)
    expect(hints.map((hint) => chars.slice(hint.start ?? 0, hint.end ?? 0).join(''))).toEqual(hints.map((hint) => hint.original))
    expect(hints.every((hint) => !('id' in hint))).toBe(true)
  })

  it('answers 503 when live hints are switched to unavailable', () => {
    // Arrange + Act
    const response = check({ language: 'es', text: 'Hoy yo es feliz.' }, 'check-unavailable')
    // Assert
    expect(response.status).toBe(503)
  })

  it('rejects an unsupported language or blank text like the backend', () => {
    // Arrange + Act
    const statuses = [check({ language: 'xx', text: 'Hola' }, ''), check({ language: 'es', text: '  ' }, '')].map((r) => r.status)
    // Assert
    expect(statuses).toEqual([422, 422])
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm -C frontend exec vitest run src/hooks src/mocks/check.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`frontend/src/types/check.ts`:
```ts
import type { MistakeOut } from './analysis'

// Mirrors backend/app/api/schemas/check.py. Offsets are code points into `analyzed_text` (normalised, trimmed).
export interface CheckRequest {
  language: string
  text: string
}

export type HintOut = Omit<MistakeOut, 'id'>

export interface CheckOut {
  analyzed_text: string
  hints: HintOut[]
}
```

`frontend/src/utils/endpoints.ts`: add `check: 'check',`.
`frontend/src/utils/constants.ts`:
```ts
export const STORAGE_KEYS = { draft: 'journal.draft', language: 'journal.language', liveHints: 'journal.liveHints' } as const
// Spec §7.2: check after a 1.2 s pause, and only once there is enough text to judge.
export const LIVE_HINTS = { debounceMs: 1200, minWords: 3 } as const
```
`frontend/src/hooks/queries/journalKeys.ts`: add `check: (request: CheckRequest | null) => ['check', request?.language ?? null, request?.text ?? null] as const,` (import the type).

`frontend/src/hooks/queries/useCheckQuery.ts`:
```ts
import { keepPreviousData, skipToken, useQuery } from '@tanstack/react-query'
import type { CheckOut, CheckRequest } from '@/types/check'
import { client } from '@/utils/client'
import { ENDPOINTS } from '@/utils/endpoints'
import { journalKeys } from './journalKeys'

// Keyed by the text itself: newer text is a new query, and TanStack aborts the superseded request through `signal`
// once nothing observes it, so a late answer never lands on newer text. The previous hints stay (re-anchored by the
// caller) until the new ones arrive. A failure is not retried: hints simply stay hidden.
export function useCheckQuery(request: CheckRequest | null) {
  return useQuery({
    queryKey: journalKeys.check(request),
    queryFn: request ? ({ signal }) => client.post(ENDPOINTS.check, { json: request, signal }).json<CheckOut>() : skipToken,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    gcTime: 60_000,
    retry: false,
  })
}
```

`frontend/src/hooks/misc/useDebouncedValue.ts`:
```ts
import { useEffect, useState } from 'react'

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return settled
}
```

`frontend/src/mocks/check.ts`:
```ts
import { HttpResponse } from 'msw'
import type { MistakeOut } from '@/types/analysis'
import type { CheckOut, HintOut } from '@/types/check'
import { analyzeText } from './analyzer'
import { cleanLanguage, cleanText, invalid, problem } from './responses'

const toHint = ({ kind, category, original, correction, explanation, start, end }: MistakeOut): HintOut => ({ kind, category, original, correction, explanation, start, end })

// The mock analyser's rules, with nothing stored — like the backend's /check.
export function checkText(text: string): CheckOut {
  const analysis = analyzeText('live-check', text)
  return { analyzed_text: analysis.input_text, hints: analysis.mistakes.map(toHint) }
}

export function check(body: unknown, mode: string): Response {
  if (mode === 'check-unavailable') return problem(503, 'Service Unavailable', 'Live hints are unavailable right now')
  const language = cleanLanguage(body)
  const text = cleanText(body)
  if (!language || !text) return invalid()
  return HttpResponse.json(checkText(text))
}
```

`frontend/src/mocks/handlers.ts` — import `check` and append to `handlers`:
```ts
  http.post(url(ENDPOINTS.check), async ({ request }) => (await forcedResponse()) ?? check(await request.json(), mockMode())),
```
and extend the mode comment: `` // `?mock=slow|error|empty|analysis-fail|check-unavailable` forces UI states in dev, e2e and ui-qa runs. ``

`frontend/CLAUDE.md` — the dev-data line lists `?mock=slow|error|empty|analysis-fail|check-unavailable`.

- [ ] **Step 4: Run the frontend gate**

Run: `pnpm -C frontend verify`
Expected: `ALL GATES GREEN` (nothing uses the query yet; fallow counts the new tests as entry points).

- [ ] **Step 5: Commit**

```bash
git add frontend/src frontend/CLAUDE.md
git commit -m "feat(frontend): check query with abort and newest-wins, debounce hook, in-memory /check"
```

---

### Task 5: Re-anchoring, editor decorations and accepting a hint

Pure functions with table tests, plus decoration ids in P6's `HighlightedTextarea` so a popover can find its underline.

**Files:**
- Create: `frontend/src/features/live-hints/{reanchor.ts,reanchor.test.ts,editorDecorations.ts,editorDecorations.test.ts,applyHint.ts,applyHint.test.tsx}`
- Modify: `frontend/src/features/feedback/markClasses.ts`, `frontend/src/components/ui/HighlightedTextarea/{decorate.ts,HighlightedTextarea.tsx,decorate.test.ts,HighlightedTextarea.test.tsx}`

**Interfaces:**
- Consumes: `CheckOut`, `HintOut` (Task 4); `Decoration`, `CHIP_CLASS` (P6).
- Produces:
  - `Decoration.id?: string`; `DecoratedSegment.id?: string`; marks render `data-decoration-id`.
  - `underlineClasses: Record<MistakeKind, string>` (feedback marks = tint + these).
  - `LiveHint = Omit<HintOut, 'start' | 'end'> & { key: string; id: string; start: number; end: number }` — `key` (kind|original|correction) identifies a hint for dismissal; `id` (`key@start`) is unique per placement; offsets are UTF-16 in the current text.
  - `hintKey(hint)`, `codePointToUtf16(text, codePoint)`, `reanchor(check: CheckOut | undefined, current: string, dismissed: ReadonlySet<string>): LiveHint[]`, `hintAtCaret(hints, textarea): LiveHint | undefined`.
  - `editorDecorations(chips: readonly { start: number; end: number }[], hints: readonly LiveHint[]): Decoration[]`.
  - `applyHint(textarea: HTMLTextAreaElement, replacement: { start: number; end: number; correction: string }): void`.

- [ ] **Step 1: Write the failing tests**

`frontend/src/features/live-hints/reanchor.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { CheckOut, HintOut } from '@/types/check'
import { codePointToUtf16, hintAtCaret, hintKey, reanchor } from './reanchor'

const hint = (original: string, start: number | null, correction = 'x'): HintOut => ({
  kind: 'error',
  category: 'other',
  original,
  correction,
  explanation: 'why',
  start,
  end: start === null ? null : start + Array.from(original).length,
})
const checked = (analyzed_text: string, ...hints: HintOut[]): CheckOut => ({ analyzed_text, hints })
const spans = (text: string, check: CheckOut, dismissed: Set<string> = new Set()) =>
  reanchor(check, text, dismissed).map((anchored) => [anchored.start, text.slice(anchored.start, anchored.end)])

describe('reanchor', () => {
  it.each([
    ['unchanged text', 'Hoy yo es feliz.', checked('Hoy yo es feliz.', hint('yo es', 4)), [[4, 'yo es']]],
    ['text typed before the hint', 'Ayer y hoy yo es feliz.', checked('Hoy yo es feliz.', hint('yo es', 4)), [[11, 'yo es']]],
    ['the hinted words edited away', 'Hoy yo soy feliz.', checked('Hoy yo es feliz.', hint('yo es', 4)), []],
    ['a repeated phrase: the occurrence nearest the old place', 'yo es, y luego yo es.', checked('yo es, y luego yo es.', hint('yo es', 15)), [[15, 'yo es']]],
    ['an emoji before the hint (code points vs UTF-16)', 'Hoy 😀 yo es.', checked('Hoy 😀 yo es.', hint('yo es', 6)), [[7, 'yo es']]],
    ['a hint that drifted too far', `${'a '.repeat(60)}yo es`, checked('yo es', hint('yo es', 0)), []],
    ['an unplaced hint: first occurrence', 'Hoy yo es feliz.', checked('Hoy yo es feliz.', hint('yo es', null)), [[4, 'yo es']]],
    ['overlapping hints: the later one is dropped', 'la problema es', checked('la problema es', hint('la problema', 0), hint('problema es', 3)), [[0, 'la problema']]],
  ])('handles %s', (_label, text, check, expected) => {
    // Arrange + Act
    const result = spans(text, check)
    // Assert
    expect(result).toEqual(expected)
  })

  it('never brings back a dismissed hint', () => {
    // Arrange
    const yoEs = hint('yo es', 4, 'yo soy')
    // Act
    const result = spans('Hoy yo es feliz.', checked('Hoy yo es feliz.', yoEs), new Set([hintKey(yoEs)]))
    // Assert
    expect(result).toEqual([])
  })

  it('returns nothing before the first check answers', () => {
    // Arrange + Act
    const result = reanchor(undefined, 'Hoy yo es feliz.', new Set())
    // Assert
    expect(result).toEqual([])
  })

  it('gives every placement its own id, even for identical hints', () => {
    // Arrange
    const check = checked('yo es y yo es', hint('yo es', 0), hint('yo es', 8))
    // Act
    const ids = reanchor(check, 'yo es y yo es', new Set()).map((anchored) => anchored.id)
    // Assert
    expect(new Set(ids).size).toBe(2)
  })
})

describe('codePointToUtf16', () => {
  it('counts an emoji as two UTF-16 units', () => {
    // Arrange + Act
    const index = codePointToUtf16('😀 yo', 2)
    // Assert
    expect(index).toBe(3)
  })
})

describe('hintAtCaret', () => {
  it('finds the hint under a collapsed caret and ignores selections', () => {
    // Arrange
    const [anchored] = reanchor(checked('Hoy yo es.', hint('yo es', 4)), 'Hoy yo es.', new Set())
    const textarea = document.createElement('textarea')
    textarea.value = 'Hoy yo es.'
    // Act
    textarea.setSelectionRange(6, 6)
    const atCaret = hintAtCaret(anchored ? [anchored] : [], textarea)
    textarea.setSelectionRange(4, 9)
    const onSelection = hintAtCaret(anchored ? [anchored] : [], textarea)
    // Assert
    expect(atCaret?.original).toBe('yo es')
    expect(onSelection).toBeUndefined()
  })
})
```

`frontend/src/features/live-hints/editorDecorations.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { CHIP_CLASS } from '@/components/ui/HighlightedTextarea'
import { underlineClasses } from '@/features/feedback/markClasses'
import { editorDecorations } from './editorDecorations'
import type { LiveHint } from './reanchor'

const liveHint = (start: number, end: number, kind: LiveHint['kind'] = 'error'): LiveHint => ({
  kind,
  category: 'other',
  original: 'x'.repeat(end - start),
  correction: 'y',
  explanation: 'why',
  key: `k${start}`,
  id: `k${start}@${start}`,
  start,
  end,
})

describe('editorDecorations', () => {
  it('draws chips on their own when there are no hints', () => {
    // Arrange + Act
    const decorations = editorDecorations([{ start: 6, end: 12 }], [])
    // Assert
    expect(decorations).toEqual([{ start: 6, end: 12, className: CHIP_CLASS }])
  })

  it('underlines a hint by its kind, with its id for the popover', () => {
    // Arrange + Act
    const decorations = editorDecorations([], [liveHint(4, 9, 'suggestion')])
    // Assert
    expect(decorations).toEqual([{ id: 'k4@4', start: 4, end: 9, className: underlineClasses.suggestion }])
  })

  it('combines a hint on a chip into one tinted, underlined decoration', () => {
    // Arrange + Act
    const decorations = editorDecorations([{ start: 6, end: 12 }], [liveHint(6, 12, 'vocab_help')])
    // Assert
    expect(decorations).toEqual([{ id: 'k6@6', start: 6, end: 12, className: `${CHIP_CLASS} ${underlineClasses.vocab_help}` }])
  })

  it('lets a hint win over a chip it only partly covers', () => {
    // Arrange + Act
    const decorations = editorDecorations([{ start: 6, end: 12 }], [liveHint(4, 8)])
    // Assert
    expect(decorations.map((decoration) => decoration.start)).toEqual([4])
  })
})
```

`frontend/src/features/live-hints/applyHint.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Button } from '@/components/ui/Button'
import { applyHint } from './applyHint'

function Harness() {
  const [text, setText] = useState('Hoy yo es feliz.')
  const ref = useRef<HTMLTextAreaElement>(null)
  return (
    <>
      <textarea aria-label="Entry" ref={ref} value={text} onChange={(event) => setText(event.target.value)} />
      <Button onClick={() => ref.current && applyHint(ref.current, { start: 4, end: 9, correction: 'yo soy' })}>Accept</Button>
    </>
  )
}

function stubExecCommand(result: boolean) {
  const execCommand = vi.fn(() => result)
  Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true })
  return execCommand
}

describe('applyHint', () => {
  afterEach(() => vi.restoreAllMocks())

  it('edits through the editing API so the browser can undo it', () => {
    // Arrange
    const execCommand = stubExecCommand(true)
    render(<Harness />)
    // Act
    screen.getByRole('button', { name: 'Accept' }).click()
    // Assert
    expect(execCommand).toHaveBeenCalledWith('insertText', false, 'yo soy')
    expect(screen.getByRole('textbox')).toHaveFocus()
  })

  it('falls back to replacing the range and telling React the text changed', () => {
    // Arrange
    stubExecCommand(false)
    render(<Harness />)
    // Act
    screen.getByRole('button', { name: 'Accept' }).click()
    // Assert
    const textarea = screen.getByRole<HTMLTextAreaElement>('textbox')
    expect(textarea).toHaveValue('Hoy yo soy feliz.')
    expect(textarea.selectionStart).toBe(10)
  })
})
```
(`element.click()` here, not `userEvent`: clicking a real button would move focus to it first, and the test is about what `applyHint` does with focus.)

Append to `decorate.test.ts`:
```ts
  it('carries decoration ids onto their segments', () => {
    // Arrange + Act
    const segments = decorate('ab', [{ id: 'h1', start: 0, end: 2, className: 'chip' }])
    // Assert
    expect(segments).toEqual([{ id: 'h1', text: 'ab', className: 'chip' }])
  })
```
Append to `HighlightedTextarea.test.tsx`:
```tsx
  it('labels each decorated mark with its id so overlays can find it', () => {
    // Arrange + Act
    const { container } = render(<HighlightedTextarea aria-label="Entry" value="ab" readOnly decorations={[{ id: 'h1', start: 0, end: 2, className: CHIP_CLASS }]} />)
    // Assert
    expect(container.querySelector('mark')).toHaveAttribute('data-decoration-id', 'h1')
  })
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm -C frontend exec vitest run src/features/live-hints src/components/ui/HighlightedTextarea`
Expected: FAIL — modules missing; no ids on segments.

- [ ] **Step 3: Implement**

`frontend/src/features/feedback/markClasses.ts`:
```ts
import type { MistakeKind } from '@/types/analysis'

// Kind is encoded twice — colour and underline style — so it never relies on colour vision alone. Live hints use the
// underline alone, so it can sit on top of an editor chip.
export const underlineClasses: Record<MistakeKind, string> = {
  error: 'underline decoration-mark-error decoration-wavy decoration-2 underline-offset-4',
  suggestion: 'underline decoration-mark-suggestion decoration-dashed decoration-2 underline-offset-4',
  vocab_help: 'underline decoration-mark-vocab decoration-dotted decoration-2 underline-offset-4',
}

export const markClasses: Record<MistakeKind, string> = {
  error: `bg-mark-error-bg ${underlineClasses.error}`,
  suggestion: `bg-mark-suggestion-bg ${underlineClasses.suggestion}`,
  vocab_help: `bg-mark-vocab-bg ${underlineClasses.vocab_help}`,
}
```

`decorate.ts` — `Decoration` and `DecoratedSegment` gain `id?: string`; push `{ id: decoration.id, text: …, className }` for decorated segments (plain segments unchanged; `toEqual` ignores the `undefined` id, so P6's table still passes).
`HighlightedTextarea.tsx` — the mark: `<mark key={index} data-decoration-id={segment.id} className={cn('text-fg', segment.className)}>`.

`frontend/src/features/live-hints/reanchor.ts`:
```ts
import type { CheckOut, HintOut } from '@/types/check'

export type LiveHint = Omit<HintOut, 'start' | 'end'> & {
  key: string
  id: string
  start: number
  end: number
}

// How far (UTF-16 units) a hint may travel from where the check saw it before it counts as stale.
const MAX_DRIFT = 80

export function hintKey(hint: Pick<HintOut, 'kind' | 'original' | 'correction'>): string {
  return `${hint.kind}|${hint.original}|${hint.correction}`
}

// API offsets are code points into the checked text; the textarea counts UTF-16 units.
export function codePointToUtf16(text: string, codePoint: number): number {
  return Array.from(text).slice(0, codePoint).join('').length
}

function nearest(text: string, needle: string, around: number): number | null {
  let best: number | null = null
  for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + 1)) {
    if (best === null || Math.abs(at - around) < Math.abs(best - around)) best = at
  }
  return best !== null && Math.abs(best - around) <= MAX_DRIFT ? best : null
}

function locate(hint: HintOut, checked: string, current: string): number | null {
  // An unplaced hint (null offsets) still names its words: anchor it to their first occurrence.
  if (hint.start === null) {
    const at = current.indexOf(hint.original)
    return at === -1 ? null : at
  }
  return nearest(current, hint.original, codePointToUtf16(checked, hint.start))
}

function withoutOverlaps(hints: LiveHint[]): LiveHint[] {
  const kept: LiveHint[] = []
  for (const hint of [...hints].sort((a, b) => a.start - b.start)) {
    if (hint.start >= (kept.at(-1)?.end ?? 0)) kept.push(hint)
  }
  return kept
}

// Hints describe a snapshot while the writer keeps typing: each moves to the occurrence of its words nearest its old
// place, or is dropped. Dismissed hints and overlaps never come back.
export function reanchor(check: CheckOut | undefined, current: string, dismissed: ReadonlySet<string>): LiveHint[] {
  if (!check) return []
  const anchored: LiveHint[] = []
  for (const hint of check.hints) {
    const key = hintKey(hint)
    const at = dismissed.has(key) || hint.original === '' ? null : locate(hint, check.analyzed_text, current)
    if (at !== null) anchored.push({ ...hint, key, id: `${key}@${at}`, start: at, end: at + hint.original.length })
  }
  return withoutOverlaps(anchored)
}

// Only a click that leaves a caret opens a hint: selecting text to edit it must not pop anything up.
export function hintAtCaret(hints: readonly LiveHint[], textarea: HTMLTextAreaElement): LiveHint | undefined {
  const { selectionStart, selectionEnd } = textarea
  if (selectionStart !== selectionEnd) return undefined
  return hints.find((hint) => selectionStart >= hint.start && selectionStart <= hint.end)
}
```

`frontend/src/features/live-hints/editorDecorations.ts`:
```ts
import { CHIP_CLASS, type Decoration } from '@/components/ui/HighlightedTextarea'
import { underlineClasses } from '@/features/feedback/markClasses'
import type { LiveHint } from './reanchor'

interface Range {
  start: number
  end: number
}

const overlaps = (a: Range, b: Range) => a.start < b.end && b.start < a.end

// Hints are underlines only, so a hint on a `[word]` chip combines with it (tint + underline) instead of hiding it.
export function editorDecorations(chips: readonly Range[], hints: readonly LiveHint[]): Decoration[] {
  const fromHints = hints.map((hint) => {
    const onChip = chips.some((chip) => chip.start === hint.start && chip.end === hint.end)
    const className = onChip ? `${CHIP_CLASS} ${underlineClasses[hint.kind]}` : underlineClasses[hint.kind]
    return { id: hint.id, start: hint.start, end: hint.end, className }
  })
  const freeChips = chips.filter((chip) => !hints.some((hint) => overlaps(chip, hint))).map((chip) => ({ ...chip, className: CHIP_CLASS }))
  return [...fromHints, ...freeChips]
}
```

`frontend/src/features/live-hints/applyHint.ts`:
```ts
export interface Replacement {
  start: number
  end: number
  correction: string
}

export function applyHint(textarea: HTMLTextAreaElement, { start, end, correction }: Replacement): void {
  textarea.focus()
  textarea.setSelectionRange(start, end)
  // Deprecated, yet still the only edit that lands in the browser's undo stack, so ⌘/Ctrl+Z restores the original.
  if (typeof document.execCommand === 'function' && document.execCommand('insertText', false, correction)) return
  textarea.setRangeText(correction, start, end, 'end')
  // React listens for `input`; setRangeText alone would leave the controlled value stale.
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
}
```

- [ ] **Step 4: Run the frontend gate**

Run: `pnpm -C frontend verify`
Expected: `ALL GATES GREEN` (FeedbackView mark-class tests unchanged: the composed strings are identical).

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): re-anchor live hints, merge them with editor chips, accept through the editing API"
```

---

### Task 6: Composer UI — underlines, popover, hint list, switch

**Files:**
- Create: `frontend/src/components/ui/Switch/{Switch.tsx,Switch.test.tsx,index.ts}`, `frontend/src/features/live-hints/{useLiveHints.ts,useLiveHintsSetting.ts,useAnchorBelow.ts,HintPopover.tsx,HintList.tsx,LiveHintsControls.tsx}`, `frontend/src/features/write/{ComposerEditor.tsx,ComposerEditor.test.tsx,ComposerEditor.states.test.tsx}`
- Modify: `frontend/src/features/editor/EntryTextField.tsx`, `frontend/src/features/write/EntryForm.tsx`, `frontend/DESIGN.md`

**Interfaces:**
- Consumes: Tasks 4–5, `Card`, `Button`, `Correction`, `KIND_LABELS`, `useLocalStorage`, `useFocusOnMount`, `bracketRanges`, `countWords`, `entryLength`, `MAX_ENTRY_CHARS`, `LIVE_HINTS`.
- Produces:
  - `Switch({ label, checked, onChange })` — `role="switch"` `<Button>` with `aria-checked`.
  - `useLiveHintsSetting(): [boolean, (on: boolean) => void]` — default on; `'off'` stored when off.
  - `useLiveHints({ text, language, enabled }): { hints: LiveHint[]; dismiss(key: string): void }` — debounced request when enabled, language set, ≥ 3 words and within the limit; no hints while disabled or on any error.
  - `HintPopover({ hint, onAccept, onDismiss })` — non-modal `role="dialog"` named "Hint: <original> should be <correction>", positioned under its underline, Accept focused (Enter), Esc dismisses.
  - `HintList({ id, hints, onAccept, onDismiss })` — `<ul aria-label="Live hints">`, per item "Accept <correction> for <original>" / "Dismiss hint for <original>".
  - `LiveHintsControls({ on, onToggle, hints, onAccept, onDismiss })` — switch, "n hints" toggle (only when there are hints), polite count (`aria-live`, not `role="status"`, so the composer keeps a single status).
  - `EntryTextField` new optional props: `decorations?: readonly Decoration[]` (replaces the default chips), `onTextareaClick?`, `overlay?: ReactNode`, `footer?: ReactNode`.
  - `ComposerEditor({ language, value, onChange, onSubmitShortcut, readOnly, focusOnMount })` — used by `EntryForm` instead of `EntryTextField`.

- [ ] **Step 1: Write the failing tests**

`frontend/src/components/ui/Switch/Switch.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Switch } from '.'

describe('Switch', () => {
  it('is a named switch that reports the flipped value', async () => {
    // Arrange
    const onChange = vi.fn()
    render(<Switch label="Live hints" checked onChange={onChange} />)
    // Act
    await userEvent.setup().click(screen.getByRole('switch', { name: 'Live hints' }))
    // Assert
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    expect(onChange).toHaveBeenCalledWith(false)
  })
})
```

`frontend/src/features/write/ComposerEditor.test.tsx`:
```tsx
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { waitForLanguages } from '@/test/helpers'
import { renderWithProviders } from '@/test/renderWithProviders'
import { STORAGE_KEYS } from '@/utils/constants'
import { WriteScreen } from './WriteScreen'

const TEXT = 'Hoy yo es feliz y tranquilo.'
const FIXED = 'Hoy yo soy feliz y tranquilo.'

// A stored draft is checked at once (the debounce starts at the current text) and avoids typing `[`.
async function renderWithDraft(text = TEXT) {
  localStorage.setItem(STORAGE_KEYS.draft, text)
  const utils = renderWithProviders(<WriteScreen />)
  await waitForLanguages()
  return { user: userEvent.setup(), ...utils }
}

const editor = () => screen.getByLabelText<HTMLTextAreaElement>('Your entry')
const hintsButton = () => screen.findByRole('button', { name: '1 hint' })

describe('ComposerEditor live hints', () => {
  it('underlines a likely mistake and lists it as a hint', async () => {
    // Arrange
    const { user, container } = await renderWithDraft()
    // Act
    await user.click(await hintsButton())
    // Assert
    expect(container.querySelector('mark[data-decoration-id]')).toHaveTextContent('yo es')
    expect(within(screen.getByRole('list', { name: 'Live hints' })).getByText(/With «yo»/)).toBeInTheDocument()
  })

  it('accepts a hint from the list: the text changes and the hint goes', async () => {
    // Arrange
    const { user } = await renderWithDraft()
    await user.click(await hintsButton())
    // Act
    await user.click(screen.getByRole('button', { name: 'Accept yo soy for yo es' }))
    // Assert
    expect(editor()).toHaveValue(FIXED)
    expect(screen.queryByRole('button', { name: '1 hint' })).not.toBeInTheDocument()
  })

  it('opens the hint from a click inside the underlined words, and Enter accepts it', async () => {
    // Arrange
    const { user } = await renderWithDraft()
    await hintsButton()
    // Act
    await user.pointer({ keys: '[MouseLeft]', target: editor(), offset: 6 })
    const popover = screen.getByRole('dialog', { name: 'Hint: yo es should be yo soy' })
    expect(within(popover).getByRole('button', { name: 'Accept' })).toHaveFocus()
    await user.keyboard('{Enter}')
    // Assert
    expect(editor()).toHaveValue(FIXED)
  })

  it('dismisses with Escape, returns to the text and keeps the hint away', async () => {
    // Arrange
    const { user } = await renderWithDraft()
    await hintsButton()
    await user.pointer({ keys: '[MouseLeft]', target: editor(), offset: 6 })
    // Act
    await user.keyboard('{Escape}')
    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '1 hint' })).not.toBeInTheDocument()
    expect(editor()).toHaveFocus()
    expect(editor()).toHaveValue(TEXT)
  })

  it('does not open anything for a click outside the hinted words', async () => {
    // Arrange
    const { user } = await renderWithDraft()
    await hintsButton()
    // Act
    await user.pointer({ keys: '[MouseLeft]', target: editor(), offset: 20 })
    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
```

`frontend/src/features/write/ComposerEditor.states.test.tsx`:
```tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { apiUrl, setMockMode, waitForLanguages } from '@/test/helpers'
import { renderWithProviders } from '@/test/renderWithProviders'
import { server } from '@/test/server'
import { ENDPOINTS } from '@/utils/endpoints'
import { STORAGE_KEYS } from '@/utils/constants'
import { WriteScreen } from './WriteScreen'

function countChecks(): { count: number } {
  const seen = { count: 0 }
  server.use(
    http.post(apiUrl(ENDPOINTS.check), () => {
      seen.count += 1
    }),
  )
  return seen
}

async function renderWithDraft(text: string) {
  localStorage.setItem(STORAGE_KEYS.draft, text)
  renderWithProviders(<WriteScreen />)
  await waitForLanguages()
  return userEvent.setup()
}

describe('ComposerEditor live hint states', () => {
  it('turns off with the Live hints switch and remembers it', async () => {
    // Arrange
    const user = await renderWithDraft('Hoy yo es feliz y tranquilo.')
    await screen.findByRole('button', { name: '1 hint' })
    // Act
    await user.click(screen.getByRole('switch', { name: 'Live hints' }))
    // Assert
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByRole('button', { name: '1 hint' })).not.toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEYS.liveHints)).toBe('off')
  })

  it('stays silent when live hints are unavailable', async () => {
    // Arrange
    setMockMode('check-unavailable')
    const seen = countChecks()
    // Act
    await renderWithDraft('Hoy yo es feliz y tranquilo.')
    await delay(100)
    // Assert
    expect(seen.count).toBe(1)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /hint/ })).not.toBeInTheDocument()
  })

  it('waits for three words before checking', async () => {
    // Arrange
    const seen = countChecks()
    // Act
    await renderWithDraft('Hola yo')
    await delay(100)
    // Assert
    expect(seen.count).toBe(0)
  })

  it('does not check while the switch is off', async () => {
    // Arrange
    localStorage.setItem(STORAGE_KEYS.liveHints, 'off')
    const seen = countChecks()
    // Act
    await renderWithDraft('Hoy yo es feliz y tranquilo.')
    await delay(100)
    // Assert
    expect(seen.count).toBe(0)
  })

  it('hides hints after a server error instead of showing stale ones', async () => {
    // Arrange
    server.use(http.post(apiUrl(ENDPOINTS.check), () => HttpResponse.json({ status: 500 }, { status: 500 })))
    // Act
    await renderWithDraft('Hoy yo es feliz y tranquilo.')
    await delay(100)
    // Assert
    expect(screen.queryByRole('button', { name: /hint/ })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm -C frontend exec vitest run src/components/ui/Switch src/features/write`
Expected: FAIL — no `Switch`, no hints UI.

- [ ] **Step 3: Implement the pieces**

`frontend/src/components/ui/Switch/Switch.tsx`:
```tsx
import { Button } from '@/components/ui/Button'
import { cn } from '@/utils/utils'

export interface SwitchProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function Switch({ label, checked, onChange }: SwitchProps) {
  return (
    <Button role="switch" aria-checked={checked} variant="ghost" className="px-2" onClick={() => onChange(!checked)}>
      <span aria-hidden="true" className={cn('relative inline-flex h-5 w-9 shrink-0 rounded-full border border-border-input bg-surface transition-colors', checked && 'border-primary bg-primary')}>
        <span className={cn('absolute top-0.5 left-0.5 size-3.5 rounded-full bg-fg-secondary transition-transform', checked && 'translate-x-4 bg-primary-contrast')} />
      </span>
      {label}
    </Button>
  )
}
```
`index.ts`: `export * from './Switch'`. `frontend/DESIGN.md`: `| \`Switch\` | — | \`role="switch"\` button with \`aria-checked\`; label is the visible text |`.

`frontend/src/features/live-hints/useLiveHintsSetting.ts`:
```ts
import { useLocalStorage } from '@/hooks/misc/useLocalStorage'
import { STORAGE_KEYS } from '@/utils/constants'

// On by default (spec §7.2); only "off" is stored, so clearing storage turns hints back on.
export function useLiveHintsSetting(): [boolean, (on: boolean) => void] {
  const [stored, setStored] = useLocalStorage(STORAGE_KEYS.liveHints)
  return [stored !== 'off', (on) => setStored(on ? '' : 'off')]
}
```

`frontend/src/features/live-hints/useLiveHints.ts`:
```ts
import { useMemo, useState } from 'react'
import { useDebouncedValue } from '@/hooks/misc/useDebouncedValue'
import { useCheckQuery } from '@/hooks/queries/useCheckQuery'
import { LIVE_HINTS, MAX_ENTRY_CHARS } from '@/utils/constants'
import { countWords, entryLength } from '@/utils/text'
import { reanchor, type LiveHint } from './reanchor'

export interface LiveHintsInput {
  text: string
  language: string
  enabled: boolean
}

export function useLiveHints({ text, language, enabled }: LiveHintsInput) {
  const settled = useDebouncedValue(text, LIVE_HINTS.debounceMs)
  const ready = enabled && language !== '' && countWords(settled) >= LIVE_HINTS.minWords && entryLength(settled) <= MAX_ENTRY_CHARS
  const check = useCheckQuery(ready ? { text: settled, language } : null)
  // Dismissed for this composer session: a new entry remounts the composer and starts clean.
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set())
  const hints: LiveHint[] = useMemo(
    () => (ready && !check.isError ? reanchor(check.data, text, dismissed) : []),
    [ready, check.isError, check.data, text, dismissed],
  )
  return { hints, dismiss: (key: string) => setDismissed((previous) => new Set(previous).add(key)) }
}
```

`frontend/src/features/live-hints/useAnchorBelow.ts`:
```ts
import { useLayoutEffect, type RefObject } from 'react'

// Pixel geometry from the rendered underline cannot be a token, so it is written on the element after layout.
export function useAnchorBelow(ref: RefObject<HTMLElement | null>, decorationId: string): void {
  useLayoutEffect(() => {
    const popover = ref.current
    const frame = popover?.parentElement
    const marks = Array.from(frame?.querySelectorAll<HTMLElement>('mark[data-decoration-id]') ?? [])
    const mark = marks.find((candidate) => candidate.dataset.decorationId === decorationId)
    if (!popover || !frame || !mark) return
    const frameBox = frame.getBoundingClientRect()
    const markBox = mark.getBoundingClientRect()
    const left = Math.min(Math.max(0, markBox.left - frameBox.left), Math.max(0, frameBox.width - popover.offsetWidth))
    popover.style.left = `${left}px`
    popover.style.top = `${markBox.bottom - frameBox.top + 4}px`
  }, [ref, decorationId])
}
```

`frontend/src/features/live-hints/HintPopover.tsx`:
```tsx
import { useRef, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Correction } from '@/features/feedback/Correction'
import { useFocusOnMount } from '@/hooks/misc/useFocusOnMount'
import type { LiveHint } from './reanchor'
import { useAnchorBelow } from './useAnchorBelow'

export interface HintPopoverProps {
  hint: LiveHint
  onAccept: () => void
  onDismiss: () => void
}

// Opened only by a deliberate click on an underline, so taking focus (Enter accepts, Esc dismisses) is expected.
export function HintPopover({ hint, onAccept, onDismiss }: HintPopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  const acceptRef = useFocusOnMount<HTMLButtonElement>()
  useAnchorBelow(ref, hint.id)
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    onDismiss()
  }
  return (
    <div ref={ref} role="dialog" aria-label={`Hint: ${hint.original} should be ${hint.correction}`} className="absolute z-dropdown w-72 max-w-full" onKeyDown={onKeyDown}>
      <Card className="flex flex-col gap-2 p-3 text-sm shadow-md md:p-3">
        <p className="font-medium">
          <Correction original={hint.original} correction={hint.correction} />
        </p>
        <p className="text-muted">{hint.explanation}</p>
        <div className="flex gap-2">
          <Button ref={acceptRef} variant="primary" onClick={onAccept}>
            Accept
          </Button>
          <Button variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </Card>
    </div>
  )
}
```

`frontend/src/features/live-hints/HintList.tsx`:
```tsx
import { Button } from '@/components/ui/Button'
import { Correction } from '@/features/feedback/Correction'
import { KIND_LABELS } from '@/features/feedback/labels'
import type { LiveHint } from './reanchor'

export interface HintListProps {
  id: string
  hints: readonly LiveHint[]
  onAccept: (hint: LiveHint) => void
  onDismiss: (hint: LiveHint) => void
}

// The accessible path to hints: underlines are decoration in an aria-hidden layer.
export function HintList({ id, hints, onAccept, onDismiss }: HintListProps) {
  return (
    <ul id={id} aria-label="Live hints" className="flex flex-col gap-2">
      {hints.map((hint) => (
        <li key={hint.id} className="flex flex-col gap-2 rounded-md border border-border bg-bg p-3 text-sm">
          <p>
            <Correction original={hint.original} correction={hint.correction} /> <span className="text-muted">· {KIND_LABELS[hint.kind]}</span>
          </p>
          <p className="text-muted">{hint.explanation}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" aria-label={`Accept ${hint.correction} for ${hint.original}`} onClick={() => onAccept(hint)}>
              Accept
            </Button>
            <Button variant="ghost" aria-label={`Dismiss hint for ${hint.original}`} onClick={() => onDismiss(hint)}>
              Dismiss
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
```

`frontend/src/features/live-hints/LiveHintsControls.tsx`:
```tsx
import { useId, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Switch'
import { pluralize } from '@/utils/formatter'
import { HintList } from './HintList'
import type { LiveHint } from './reanchor'

export interface LiveHintsControlsProps {
  on: boolean
  onToggle: (on: boolean) => void
  hints: readonly LiveHint[]
  onAccept: (hint: LiveHint) => void
  onDismiss: (hint: LiveHint) => void
}

export function LiveHintsControls({ on, onToggle, hints, onAccept, onDismiss }: LiveHintsControlsProps) {
  const [expanded, setExpanded] = useState(false)
  const listId = useId()
  const visible = on && hints.length > 0
  const label = pluralize(hints.length, 'hint')
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Switch label="Live hints" checked={on} onChange={onToggle} />
        {visible && (
          <Button variant="ghost" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded((open) => !open)}>
            {label}
          </Button>
        )}
        {/* aria-live, not role="status": the composer's save status stays the only status. Checks are debounced, so this is throttled. */}
        <p aria-live="polite" className="sr-only">
          {visible ? label : ''}
        </p>
      </div>
      {visible && expanded && <HintList id={listId} hints={hints} onAccept={onAccept} onDismiss={onDismiss} />}
    </div>
  )
}
```

- [ ] **Step 4: Wire the composer**

`frontend/src/features/editor/EntryTextField.tsx` — new optional props and layout:
```tsx
import type { KeyboardEvent, MouseEvent, ReactNode, Ref } from 'react'
import { CHIP_CLASS, HighlightedTextarea, type Decoration } from '@/components/ui/HighlightedTextarea'
…
export interface EntryTextFieldProps {
  …existing props…
  // Replaces the default `[word]` chips; callers that add decorations merge the chips themselves.
  decorations?: readonly Decoration[]
  onTextareaClick?: (event: MouseEvent<HTMLTextAreaElement>) => void
  // Positioned over the editor (absolute, inside a relative frame): the live-hint popover.
  overlay?: ReactNode
  footer?: ReactNode
}
…
  const chips = bracketRanges(value).map((range) => ({ ...range, className: CHIP_CLASS }))
  return (
    <Field label={label} htmlFor={id}>
      <div className="relative">
        <HighlightedTextarea …existing props… decorations={decorations ?? chips} onClick={onTextareaClick} />
        {overlay}
      </div>
      …hint/count row and over-limit message unchanged…
      {footer}
    </Field>
  )
```
(Destructure the four new props in the signature; keep the function under 60 lines — move the `onKeyDown` handler above `return` as it is today.)

`frontend/src/features/write/ComposerEditor.tsx`:
```tsx
import { useCallback, useRef, useState, type MouseEvent } from 'react'
import { EntryTextField } from '@/features/editor/EntryTextField'
import { applyHint } from '@/features/live-hints/applyHint'
import { editorDecorations } from '@/features/live-hints/editorDecorations'
import { HintPopover } from '@/features/live-hints/HintPopover'
import { LiveHintsControls } from '@/features/live-hints/LiveHintsControls'
import { hintAtCaret, type LiveHint } from '@/features/live-hints/reanchor'
import { useLiveHints } from '@/features/live-hints/useLiveHints'
import { useLiveHintsSetting } from '@/features/live-hints/useLiveHintsSetting'
import { bracketRanges } from '@/utils/text'

export interface ComposerEditorProps {
  language: string
  value: string
  onChange: (text: string) => void
  onSubmitShortcut: () => void
  readOnly: boolean
  focusOnMount: boolean
}

export function ComposerEditor({ language, value, onChange, onSubmitShortcut, readOnly, focusOnMount }: ComposerEditorProps) {
  const [liveOn, setLiveOn] = useLiveHintsSetting()
  const live = useLiveHints({ text: value, language, enabled: liveOn && !readOnly })
  const [openId, setOpenId] = useState<string | null>(null)
  const textarea = useRef<HTMLTextAreaElement | null>(null)
  const attach = useCallback(
    (node: HTMLTextAreaElement | null) => {
      textarea.current = node
      if (node && focusOnMount) node.focus()
    },
    [focusOnMount],
  )
  const open = live.hints.find((hint) => hint.id === openId) ?? null
  const accept = (hint: LiveHint) => {
    setOpenId(null)
    if (textarea.current) applyHint(textarea.current, hint)
  }
  const dismiss = (hint: LiveHint) => {
    setOpenId(null)
    live.dismiss(hint.key)
    textarea.current?.focus()
  }
  const onTextareaClick = (event: MouseEvent<HTMLTextAreaElement>) => setOpenId(hintAtCaret(live.hints, event.currentTarget)?.id ?? null)
  return (
    <EntryTextField
      id="entry-text"
      label="Your entry"
      value={value}
      onChange={onChange}
      onSubmitShortcut={onSubmitShortcut}
      readOnly={readOnly}
      textareaRef={attach}
      decorations={editorDecorations(bracketRanges(value), live.hints)}
      onTextareaClick={onTextareaClick}
      overlay={open && <HintPopover hint={open} onAccept={() => accept(open)} onDismiss={() => dismiss(open)} />}
      footer={<LiveHintsControls on={liveOn} onToggle={setLiveOn} hints={live.hints} onAccept={accept} onDismiss={dismiss} />}
    />
  )
}
```

`frontend/src/features/write/EntryForm.tsx` — replace the `EntryTextField` element with:
```tsx
      <ComposerEditor language={language} value={text} onChange={onTextChange} onSubmitShortcut={submit} readOnly={locked} focusOnMount={focusOnMount} />
```
and drop the `useFocusOnMount` import and `focusRef` (focus now lives in `ComposerEditor`).

- [ ] **Step 5: Run the unit tests**

Run: `pnpm -C frontend exec vitest run`
Expected: PASS — including every P6 Write/Workspace test (their entries now also get underlines; the textarea, its label and the single `role="status"` are unchanged).

- [ ] **Step 6: Run the frontend gate**

Run: `pnpm -C frontend verify`
Expected: `ALL GATES GREEN`. The P6 chip journey still sees exactly one `mark` for `[park]` (a vocab hint on the chip merges into it).

- [ ] **Step 7: Commit**

```bash
git add frontend/src frontend/DESIGN.md
git commit -m "feat(frontend): live hint underlines, caret popover, accessible hint list and a remembered switch"
```

---
### Task 7: End-to-end — mock journeys and the full-stack journey

**Files:**
- Create: `frontend/e2e/live-hints.spec.ts`, `frontend/e2e-stack/live-hints.spec.ts`

**Interfaces:**
- Consumes: the P6 helpers `mainColumn`, `composerLanguage` (`e2e/workspace.ts`), `expectNoA11yViolations`, `expectButtonsShowPointer`.
- Produces: 4 mock journeys × desktop/mobile; 1 full-stack journey × desktop/mobile (`make e2e-stack` total 8).

- [ ] **Step 1: Write the mock journeys**

`frontend/e2e/live-hints.spec.ts`:
```ts
import { expect, test, type Page } from '@playwright/test'
import { expectNoA11yViolations } from './a11y'
import { expectButtonsShowPointer } from './cursor'
import { composerLanguage, mainColumn } from './workspace'

const TEXT = 'Hoy yo es feliz y tranquilo.'
const FIXED = 'Hoy yo soy feliz y tranquilo.'

async function expectHealthy(page: Page): Promise<void> {
  await expectNoA11yViolations(page)
  await expectButtonsShowPointer(page)
}

async function write(page: Page, path = '/'): Promise<void> {
  await page.goto(path)
  await composerLanguage(page).selectOption('es')
  await page.getByLabel('Your entry').fill(TEXT)
}

const hintsButton = (page: Page) => mainColumn(page).getByRole('button', { name: '1 hint' })
// The underline lives in the aria-hidden backdrop, so it is reached by element, not role.
const underline = (page: Page) => mainColumn(page).locator('mark[data-decoration-id]', { hasText: 'yo es' })

test('a hint appears after a pause, is accepted from the list, undone, accepted again, and the entry submits clean', async ({ page }) => {
  // Arrange
  await write(page)
  await expect(underline(page)).toBeVisible()
  await expectHealthy(page)
  // Act
  await hintsButton(page).click()
  await mainColumn(page).getByRole('button', { name: 'Accept yo soy for yo es' }).click()
  const editor = page.getByLabel('Your entry')
  await expect(editor).toHaveValue(FIXED)
  await editor.press('ControlOrMeta+z')
  await expect(editor).toHaveValue(TEXT)
  await mainColumn(page).getByRole('button', { name: 'Accept yo soy for yo es' }).click()
  await mainColumn(page).getByRole('button', { name: 'Get feedback' }).click()
  // Assert
  await expect(mainColumn(page).getByText('Great job — no mistakes found!')).toBeVisible()
  await expectHealthy(page)
})

test('clicking an underline opens the hint; Enter accepts it', async ({ page }) => {
  // Arrange
  await write(page)
  const box = await underline(page).boundingBox()
  // Act
  if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  const popover = page.getByRole('dialog', { name: 'Hint: yo es should be yo soy' })
  await expect(popover.getByRole('button', { name: 'Accept' })).toBeFocused()
  await expectHealthy(page)
  await page.keyboard.press('Enter')
  // Assert
  expect(box).not.toBeNull()
  await expect(page.getByLabel('Your entry')).toHaveValue(FIXED)
  await expect(popover).toBeHidden()
})

test('the Live hints switch turns hints off and stays off after a reload', async ({ page }) => {
  // Arrange
  await write(page)
  await expect(hintsButton(page)).toBeVisible()
  // Act
  await mainColumn(page).getByRole('switch', { name: 'Live hints' }).click()
  await page.reload()
  // Assert
  await expect(mainColumn(page).getByRole('switch', { name: 'Live hints' })).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByLabel('Your entry')).toHaveValue(TEXT)
  await expect(underline(page)).toHaveCount(0)
  await expectHealthy(page)
})

test('when live hints are unavailable, writing and feedback carry on without them', async ({ page }) => {
  // Arrange
  await write(page, '/?mock=check-unavailable')
  // Act — wait past the debounce and the request.
  await page.waitForTimeout(2000)
  // Assert
  await expect(underline(page)).toHaveCount(0)
  await expect(mainColumn(page).getByRole('alert')).toHaveCount(0)
  await mainColumn(page).getByRole('button', { name: 'Get feedback' }).click()
  await expect(mainColumn(page).getByRole('heading', { name: 'Feedback' })).toBeVisible()
})
```

- [ ] **Step 2: Run them**

Run: `pnpm -C frontend exec playwright test e2e/live-hints.spec.ts`
Expected: `8 passed`. Undo is real browser behaviour (Chromium supports `insertText` undo); if the undo step fails, the fallback path ran — check that `document.execCommand('insertText')` returned true, fix `applyHint`, never drop the step.

- [ ] **Step 3: Write the full-stack journey**

`frontend/e2e-stack/live-hints.spec.ts`:
```ts
import { expect, test } from '@playwright/test'
import { expectNoA11yViolations } from '../e2e/a11y'
import { expectButtonsShowPointer } from '../e2e/cursor'
import { composerLanguage, mainColumn } from '../e2e/workspace'

const DEMO_SUMMARY = 'Demo feedback — configure Claude for real corrections.'

test('the real stack hints while typing; an accepted hint is gone from the saved feedback', async ({ page }, testInfo) => {
  // Arrange — unique per run and project, because the stack's database outlives one test.
  const tag = `(${testInfo.project.name} ${Date.now()})`
  const main = mainColumn(page)
  await page.goto('/')
  await composerLanguage(page).selectOption('es')
  await page.getByLabel('Your entry').fill(`Hoy yo es feliz. ${tag}`)
  // Act
  await main.getByRole('button', { name: '1 hint' }).click()
  await main.getByRole('button', { name: 'Accept yo soy for yo es' }).click()
  await expect(page.getByLabel('Your entry')).toHaveValue(`Hoy yo soy feliz. ${tag}`)
  await expectNoA11yViolations(page)
  await main.getByRole('button', { name: 'Get feedback' }).click()
  // Assert
  await expect(main.getByText(DEMO_SUMMARY)).toBeVisible()
  await expect(main.getByRole('button', { name: /yo es/ })).toHaveCount(0)
  await expectButtonsShowPointer(page)
})
```

- [ ] **Step 4: Run both gates**

Run: `pnpm -C frontend verify` then `make e2e-stack`
Expected: `ALL GATES GREEN`, then `8 passed`.

- [ ] **Step 5: Commit**

```bash
git add frontend/e2e/live-hints.spec.ts frontend/e2e-stack/live-hints.spec.ts
git commit -m "test(frontend): live hint journeys on the mock API and the full stack"
```

---

### Task 8: Docs and phase checkpoint

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-10-10-ai-language-journal-design.md` (§2, §5, §9), `docs/loom-outline.md`, `docs/superpowers/plans/2026-10-10-00-index.md`; any file a BLOCKING finding names.
- Create: `docs/qa/p7-*.png`.

**Interfaces:**
- Consumes: everything above.
- Produces: P7 marked done with evidence.

- [ ] **Step 1: ui-qa**

Dispatch the `ui-qa` agent (mock build on `http://localhost:4173`) at 1280×800 and 375×812, keyboard pass included, screenshots `docs/qa/p7-<n>-<name>-{desktop,mobile}.png`:
1. Typing `Hoy yo es feliz y tranquilo.` and pausing shows a wavy underline under «yo es» within ~2 s; nothing pops up by itself; caret and text stay aligned while typing on.
2. "1 hint" appears next to the "Live hints" switch; it opens a list with the correction, explanation, Accept and Dismiss; everything works by keyboard; the count is announced politely.
3. Clicking inside the underline opens the popover under the word (inside the editor on a phone); Accept is focused; Enter accepts, Esc dismisses and returns to the text.
4. ⌘/Ctrl+Z after Accept restores the original words.
5. `Quiero ir al [park] hoy` shows one chip with a dotted underline; accepting replaces `[park]` with the word.
6. Editing the underlined words makes the hint disappear; typing before them moves it along.
7. The switch turns hints off; the choice survives a reload.
8. `/?mock=check-unavailable` and `/?mock=error`: no underline, no alert; "Get feedback" works.
9. Dark mode: underlines and chips legible; no horizontal scroll; no console errors outside `?mock=error`.

- [ ] **Step 2: Reviewer**

Dispatch the `reviewer` agent on the P7 commit range (Task 1 through Task 7) with this plan, P6 design §7.2 and the main spec. Fix every BLOCKING finding — failing test first, `make verify` green — one commit per fix, then re-run the affected ui-qa criteria. Record SHOULD findings in the index row.

- [ ] **Step 3: Real-model check (controller, needs a key)**

With `ANTHROPIC_API_KEY` set, `docker compose up --build`, then:
```bash
curl -s -X POST localhost:8080/api/v1/check -H 'content-type: application/json' \
  -d '{"language":"es","text":"Ayer yo es feliz con la problema."}' -w '\n%{http_code} %{time_total}s\n'
```
Expected: `200` with hints for «yo es» and «la problema» in a few seconds. A `503` means the key cannot use `AI_LIVE_MODEL` — set it to a model the account can call and record the choice in `.env.example` and the README. Paste the status and time into the README cell `⟨FILL: live check latency⟩`.

- [ ] **Step 4: Docs**

`README.md`:
- Product decisions — replace the "Feedback timing" row: `| Feedback timing | Quiet live hints while writing (fast model, underlines, one-click accept); full saved feedback on request | Underlines with opt-in accept keep the flow; the stored analysis stays the single source of history and insights |`.
- API table — add after `POST /entries/{id}/analyses`: `| POST | \`/check\` | \`{language, text}\` → 200 \`{analyzed_text, hints}\` from the fast live model; nothing stored; 503 when unavailable |`; GraphQL row "Nine REST endpoints" → "Ten REST endpoints".
- "The workspace (frontend)" — append: `Live hints: after a 1.2 s pause (≥ 3 words) the composer asks \`/check\` and underlines likely mistakes; click one (or open "n hints") to Accept — ⌘/Ctrl+Z undoes it — or Dismiss. A "Live hints" switch turns them off.`
- Observability — add: `Live checks log language, model, latency, hint count and failure code — never text — and are not traced in Langfuse.`
- Deliberately left out — replace the "Live grammar checking" row with `| Rate limiting on \`/check\` | Single user; the client debounces and cancels stale requests. A per-client limiter is the first scaling step |`.
- Testing table — update counts from Step 5's output (`⟨FILL: …⟩` markers until then); add a row `| Live hints latency (real model) | curl against the stack | ⟨FILL: live check latency⟩ |`.

Main spec — §2 "Feedback timing" row → `Quiet live hints while writing; full saved feedback on submit (amended by P6 §7.2)`; remove "live grammar checking" from the deliberately-left-out sentence; §5 API: add the `/check` row; §9: add the live-check logging rule.

`docs/loom-outline.md` — in the Write → feedback row, add: "Pause: «yo es» underlines; Accept from the list; ⌘Z; the saved analysis is still the source of truth." Deep-dive Q&A: **You said live correction interrupts — why add it?** The interruption was pop-ups and forced corrections; these are quiet underlines with opt-in accept, the fast model never writes history, and the switch turns them off.

- [ ] **Step 5: Full gate**

Run: `make verify` then `make e2e-stack`
Expected: `ALL GATES GREEN`, then `8 passed`. Then `grep -n "⟨FILL" README.md` — expected: no output.

- [ ] **Step 6: Mark P7 done**

Index row (numbers from Step 5):
```markdown
| P7 Live hints | `2026-10-11-p7-live-hints.md` | done (⟨ai⟩ ai + ⟨backend⟩ backend tests, ⟨Vitest⟩ Vitest, ⟨Playwright⟩ Playwright + axe, full-stack 8/8, ui-qa 9/9, real live check ⟨latency⟩) |
```

```bash
git add README.md docs/superpowers/specs/2026-10-10-ai-language-journal-design.md docs/loom-outline.md docs/superpowers/plans/2026-10-10-00-index.md docs/qa
git commit -m "docs: P7 live hints done"
```

---

## Self-review notes

- Spec §7.2 coverage: 1.2 s debounce + ≥ 3 words (T4 constants, T6 `useLiveHints`); `POST /api/v1/check` with the same analyzer on `AI_LIVE_MODEL` (default `claude-haiku-5-5`), effort low (T1, T2, T3); nothing stored, never counts toward insights (T3 "stores nothing"); stale requests aborted, newest wins (T4 abort test); underlines in the backdrop in feedback colours (T5 `editorDecorations`, `underlineClasses`); click → popover with correction, explanation, Accept (Enter) / Dismiss (Esc) (T6); Accept through the editing API so ⌘/Ctrl+Z undoes (T5 `applyHint`, T7 e2e undo); `[word]` vocab hints replace the bracketed English (the hint's `original` includes the brackets; T6/T7, ui-qa 5); re-anchoring and dropping (T5 table); dismissed stay dismissed (T5, T6); "n hints" list, keyboard-operable, polite throttled count (T6); "Live hints" switch remembered, default on (T6); demo mode scripted hints (T1 demo test, T3 demo test, T7 full stack); 5000 limit and privacy (T3 422 + privacy tests); 503 problem+json and silent UI (T3, T6, T7).
- Decisions beyond the spec, with reasons in the tasks: one attempt and no tracing for live checks (T1/T2); `/check` returns `analyzed_text` so the client knows what the code-point offsets refer to (T3); hints are keyed by kind + words + correction for dismissal and by placement for rendering (T5); the popover is opened only by a pointer click, not by caret moves, so keyboard writing is never interrupted — the list is the keyboard path (T6); the count region is `aria-live` instead of a second `role="status"` (T6).
- Placeholders: only the deliberate `⟨FILL: …⟩` / `⟨…⟩` markers for numbers that must come from real runs (T8 Steps 3–6 grep them out).
- Names across tasks: `Analyzer(max_attempts=)`, `Settings.ai_live_model|ai_live_timeout_seconds`, `_build_live_analyzer`, `app.state.live_analyzer`, `ServiceUnavailableError`, `LiveCheck`, `LiveCheckService`, `CheckRequest`/`HintOut`/`CheckOut` (both sides), `get_live_analyzer`, `LiveCheckServiceDep`, `make_live_api`/`LiveApiFactory`, `ENDPOINTS.check`, `journalKeys.check`, `useCheckQuery`, `useDebouncedValue`, `STORAGE_KEYS.liveHints`, `LIVE_HINTS`, `checkText`/`check` (mock), `underlineClasses`, `LiveHint`, `hintKey`, `codePointToUtf16`, `reanchor`, `hintAtCaret`, `editorDecorations`, `applyHint`, `Decoration.id`, `Switch`, `useLiveHintsSetting`, `useLiveHints`, `useAnchorBelow`, `HintPopover`, `HintList`, `LiveHintsControls`, `ComposerEditor`.
- Verified while planning: `Analyzer`, `FakeProvider` demo rules (`yo es`, `la problema`, `a el`, `à le`, brackets), `build_provider` signature, `AppError`/problem handler, `LanguageCode`/`EntryText`, the integration `make_api` pattern, `capture_logs` use, the mock analyser's rules and code-point offsets, `cleanText`/`cleanLanguage`, `useLocalStorage` (empty string removes the key).
- Not verified by running: whether jsdom provides `document.execCommand` (the tests stub it, so either way they are deterministic); `user.pointer({ offset })` placing the caret in a textarea under user-event 14.6 (if it does not, call `editor().setSelectionRange(6, 6)` and then `fireEvent.click(editor())` — a synthetic click leaves the selection alone, and the click handler only reads it; note why `fireEvent` is used in a comment); `AI_LIVE_MODEL`'s availability on the account (T8 Step 3); TanStack aborting the superseded query in jsdom (the abort test proves it, and is the first place to look if it flakes).

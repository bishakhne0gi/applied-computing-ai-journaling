from typing import Any

import pytest
from pydantic import SecretStr

from app import main
from app.core.config import Settings
from journal_ai import NoopTracer, Tracer


class _SpyAnalyzer:
    def __init__(self) -> None:
        self.closed = False

    async def aclose(self) -> None:
        self.closed = True


async def test_shutdown_closes_the_analyzer(settings: Settings) -> None:
    app = main.create_app(settings)
    spy = _SpyAnalyzer()

    async with app.router.lifespan_context(app):
        app.state.analyzer = spy

    assert spy.closed


async def test_shutdown_closes_the_analyzer_even_after_a_crash(settings: Settings) -> None:
    app = main.create_app(settings)
    spy = _SpyAnalyzer()

    async def crash() -> None:
        async with app.router.lifespan_context(app):
            app.state.analyzer = spy
            raise RuntimeError("boom")

    with pytest.raises(RuntimeError, match="boom"):
        await crash()

    assert spy.closed


class _OrderedAnalyzer:
    def __init__(self, calls: list[str], *, fail: bool = False) -> None:
        self._calls = calls
        self._fail = fail

    async def aclose(self) -> None:
        self._calls.append("analyzer.aclose")
        if self._fail:
            raise RuntimeError("provider close failed")


class _NamedAnalyzer:
    def __init__(self, calls: list[str], name: str) -> None:
        self._calls = calls
        self._name = name

    async def aclose(self) -> None:
        self._calls.append(self._name)


class _OrderedEngine:
    def __init__(self, calls: list[str]) -> None:
        self._calls = calls

    async def dispose(self) -> None:
        self._calls.append("engine.dispose")


def _record_engine(monkeypatch: pytest.MonkeyPatch, calls: list[str]) -> None:
    monkeypatch.setattr(main, "create_engine", lambda _url: _OrderedEngine(calls))
    monkeypatch.setattr(main, "create_sessionmaker", lambda _engine: None)


async def test_shutdown_closes_the_analyzer_before_disposing_the_engine(
    settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[str] = []
    _record_engine(monkeypatch, calls)
    app = main.create_app(settings)
    app.state.analyzer = _OrderedAnalyzer(calls)

    async with app.router.lifespan_context(app):
        pass

    assert calls == ["analyzer.aclose", "engine.dispose"]


async def test_a_failing_analyzer_close_still_disposes_the_engine_and_propagates(
    settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[str] = []
    _record_engine(monkeypatch, calls)
    app = main.create_app(settings)
    app.state.analyzer = _OrderedAnalyzer(calls, fail=True)

    with pytest.raises(RuntimeError, match="provider close failed"):
        async with app.router.lifespan_context(app):
            pass

    assert calls == ["analyzer.aclose", "engine.dispose"]


def _capture_tracer_kwargs(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    seen: dict[str, Any] = {}

    def fake_build_tracer(**kwargs: Any) -> Tracer:
        seen.update(kwargs)
        return NoopTracer()

    monkeypatch.setattr(main, "build_tracer", fake_build_tracer)
    return seen


def test_langfuse_settings_reach_the_tracer(monkeypatch: pytest.MonkeyPatch) -> None:
    seen = _capture_tracer_kwargs(monkeypatch)

    main.create_app(
        Settings(
            _env_file=None,
            langfuse_public_key="pk",
            langfuse_secret_key=SecretStr("sk"),
            langfuse_host="https://lf.test",
            environment="Production",
            release="abc123",
        )
    )

    assert seen == {
        "public_key": "pk",
        "secret_key": "sk",
        "host": "https://lf.test",
        "environment": "production",
        "release": "abc123",
    }


def test_empty_langfuse_values_from_the_example_env_file_mean_off(monkeypatch: pytest.MonkeyPatch) -> None:
    seen = _capture_tracer_kwargs(monkeypatch)

    main.create_app(
        Settings(_env_file=None, langfuse_public_key="", langfuse_secret_key=SecretStr(""), langfuse_host="")
    )

    assert [bool(seen[k]) for k in ("public_key", "secret_key", "host")] == [False, False, False]


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
    assert live == [{**live[0], "effort": "low", "timeout_seconds": 5, "max_retries": 0}]
    assert all("max_retries" not in c for c in calls if c["model"] != "m-live")


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

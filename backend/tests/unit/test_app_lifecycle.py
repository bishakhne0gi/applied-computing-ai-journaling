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

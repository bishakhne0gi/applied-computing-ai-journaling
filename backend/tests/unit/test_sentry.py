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
    assert calls[0]["before_send_transaction"] is scrub_event
    assert calls[0]["include_local_variables"] is False

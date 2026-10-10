import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from structlog.testing import capture_logs

from app.core.errors import NotFoundError
from app.db.models import AnalysisStatus
from app.services.analyses import AnalysisService
from app.services.entries import EntryService
from journal_ai import AnalysisOutcome, Analyzer, FailureCode
from journal_ai.providers.base import ProviderTimeoutError
from journal_ai.providers.fake import FakeProvider
from tests.support import YO_ES, model_reply

ENTRY_TEXT = "Ayer yo es feliz."


async def _entry_id(session: AsyncSession, text: str = ENTRY_TEXT) -> uuid.UUID:
    return (await EntryService(session).create(language="es", text=text)).id


def _service(session: AsyncSession, *script: str | Exception) -> AnalysisService:
    return AnalysisService(session, Analyzer(FakeProvider(list(script))))


async def test_a_successful_analysis_is_stored_with_aligned_mistakes(db_session: AsyncSession) -> None:
    entry_id = await _entry_id(db_session)

    analysis = await _service(db_session, model_reply(YO_ES)).run(entry_id)

    assert analysis.status is AnalysisStatus.SUCCEEDED
    assert analysis.corrected_text == "Ayer yo soy feliz."
    assert analysis.model == "fake"
    assert analysis.prompt_version == "v1"
    assert analysis.completed_at is not None
    mistake = analysis.mistakes[0]
    assert analysis.input_text[mistake.start_offset : mistake.end_offset] == "yo es"


async def test_a_failed_analysis_is_persisted_with_its_error_code(db_session: AsyncSession) -> None:
    entry_id = await _entry_id(db_session)

    analysis = await _service(db_session, ProviderTimeoutError("slow")).run(entry_id)

    assert analysis.status is AnalysisStatus.FAILED
    assert analysis.error_code is FailureCode.PROVIDER_TIMEOUT
    assert analysis.error_detail is not None
    assert analysis.mistakes == []
    history = await _service(db_session).list_for_entry(entry_id)
    assert [a.id for a in history] == [analysis.id]


async def test_the_raw_response_is_kept_when_output_is_invalid(db_session: AsyncSession) -> None:
    entry_id = await _entry_id(db_session)

    analysis = await _service(db_session, "not json", '{"truncated": ').run(entry_id)

    assert analysis.error_code is FailureCode.INVALID_OUTPUT
    assert analysis.raw_response == '{"truncated": '
    assert analysis.retried is True


async def test_a_revised_entry_gets_a_new_analysis_and_the_old_keeps_text(db_session: AsyncSession) -> None:
    entry_id = await _entry_id(db_session)
    first = await _service(db_session, model_reply(YO_ES)).run(entry_id)
    await EntryService(db_session).update_text(entry_id, "Hoy yo es feliz otra vez.")

    revised = model_reply(YO_ES, corrected="Hoy yo soy feliz otra vez.")
    second = await _service(db_session, revised).run(entry_id)

    _, latest = await EntryService(db_session).get_detail(entry_id)
    assert latest is not None
    assert latest.id == second.id
    assert first.input_text == ENTRY_TEXT
    old = first.mistakes[0]
    new = second.mistakes[0]
    assert first.input_text[old.start_offset : old.end_offset] == "yo es"
    assert second.input_text[new.start_offset : new.end_offset] == "yo es"


async def test_analysing_an_unknown_entry_raises_not_found(db_session: AsyncSession) -> None:
    with pytest.raises(NotFoundError):
        await _service(db_session).run(uuid.uuid4())


async def test_the_analysis_log_line_has_metrics_and_no_entry_text(db_session: AsyncSession) -> None:
    private_text = "Mi secreto: yo es feliz."
    entry_id = await _entry_id(db_session, text=private_text)

    with capture_logs() as logs:
        await _service(db_session, model_reply(YO_ES, corrected="Mi secreto: yo soy feliz.")).run(entry_id)

    line = next(log for log in logs if log["event"] == "analysis_completed")
    assert line["status"] == "succeeded"
    assert line["mistakes_kept"] == 1
    expected_keys = {"analysis_id", "entry_id", "latency_ms", "input_tokens", "retried", "prompt_version"}
    assert expected_keys <= line.keys()
    assert "secreto" not in str(logs)


async def test_invalid_output_is_reported_to_sentry_as_a_warning(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    captured: list[tuple[str, dict[str, object]]] = []
    monkeypatch.setattr(
        "app.services.analyses.sentry_sdk.capture_message",
        lambda message, **kwargs: captured.append((message, kwargs)),
    )
    entry_id = await _entry_id(db_session)

    await _service(db_session, "bad", "bad").run(entry_id)

    assert captured[0][0] == "analysis_invalid_output"
    assert captured[0][1]["level"] == "warning"
    assert captured[0][1]["tags"].keys() == {"analysis_id", "prompt_version"}


class _CrashingAnalyzer:
    async def analyze(self, text: str, language: str) -> AnalysisOutcome:
        raise RuntimeError(f"boom while reading {text}")


async def test_an_analyzer_crash_leaves_a_failed_row_and_propagates(db_session: AsyncSession) -> None:
    entry_id = await _entry_id(db_session)

    with pytest.raises(RuntimeError):
        await AnalysisService(db_session, _CrashingAnalyzer()).run(entry_id)

    [stored] = await _service(db_session).list_for_entry(entry_id)
    assert stored.status is AnalysisStatus.FAILED
    assert stored.error_code is FailureCode.PROVIDER_ERROR
    assert stored.error_detail == "RuntimeError"
    assert stored.completed_at is not None


async def test_a_failed_run_logs_no_entry_text(db_session: AsyncSession) -> None:
    entry_id = await _entry_id(db_session, text="Mi secreto: yo es feliz.")

    with capture_logs() as logs, pytest.raises(RuntimeError):
        await AnalysisService(db_session, _CrashingAnalyzer()).run(entry_id)

    line = next(log for log in logs if log["event"] == "analysis_completed")
    assert line["status"] == "failed"
    assert line["error_code"] == "provider_error"
    assert "secreto" not in str(logs)

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AnalysisStatus
from app.repositories.insights import ErrorRow, InsightsRepository
from journal_ai import Category, MistakeKind
from tests.support import analysis_for, entry_at, mistake

T0 = datetime(2026, 10, 1, 9, 0, tzinfo=UTC)
LATER = T0 + timedelta(minutes=5)
SUCCEEDED = AnalysisStatus.SUCCEEDED


async def _analysed(db_session: AsyncSession, language: str | None = None) -> list[ErrorRow]:
    await db_session.flush()
    return await InsightsRepository(db_session).entry_errors(language=language)


async def test_only_the_newest_succeeded_analysis_of_an_entry_counts(db_session: AsyncSession) -> None:
    entry = entry_at(T0)
    db_session.add_all(
        [
            analysis_for(entry, status=SUCCEEDED, created_at=T0, errors=3),
            analysis_for(entry, status=SUCCEEDED, created_at=LATER, errors=1),
        ]
    )

    rows = await _analysed(db_session)

    assert len(rows) == 1


@pytest.mark.parametrize("newer", [AnalysisStatus.FAILED, AnalysisStatus.PENDING])
async def test_a_newer_failed_or_unfinished_analysis_keeps_the_previous_success(
    db_session: AsyncSession, newer: AnalysisStatus
) -> None:
    entry = entry_at(T0)
    db_session.add_all(
        [
            analysis_for(entry, status=SUCCEEDED, created_at=T0, errors=2),
            analysis_for(entry, status=newer, created_at=LATER),
        ]
    )

    rows = await _analysed(db_session)

    assert len(rows) == 2


async def test_entries_without_a_succeeded_analysis_are_left_out(db_session: AsyncSession) -> None:
    failed_only, never_analysed = entry_at(T0), entry_at(LATER)
    failed = analysis_for(failed_only, status=AnalysisStatus.FAILED, created_at=T0)
    db_session.add_all([failed, never_analysed])

    assert await _analysed(db_session) == []


async def test_suggestions_and_word_help_are_not_errors(db_session: AsyncSession) -> None:
    entry = entry_at(T0)
    word_help = mistake(Category.VOCABULARY, kind=MistakeKind.VOCAB_HELP, position=1)
    db_session.add(analysis_for(entry, status=SUCCEEDED, created_at=T0, suggestions=1, mistakes=[word_help]))

    [row] = await _analysed(db_session)

    assert row.category is None


async def test_each_error_comes_back_as_a_row_in_text_order(db_session: AsyncSession) -> None:
    entry = entry_at(T0)
    mistakes = [
        mistake(Category.ARTICLE, original="a el", correction="al", position=2),
        mistake(Category.ARTICLE, original="de el", correction="del", position=0),
        mistake(Category.PREPOSITION, original="en", correction="a", position=1),
    ]
    db_session.add(analysis_for(entry, status=SUCCEEDED, created_at=T0, mistakes=mistakes))

    rows = await _analysed(db_session)

    assert [(row.category, row.original, row.correction) for row in rows] == [
        (Category.ARTICLE, "de el", "del"),
        (Category.PREPOSITION, "en", "a"),
        (Category.ARTICLE, "a el", "al"),
    ]


async def test_entries_come_oldest_first_and_can_be_filtered_by_language(db_session: AsyncSession) -> None:
    newest, oldest, french = entry_at(T0 + timedelta(hours=2)), entry_at(T0), entry_at(LATER, language="fr")
    db_session.add_all(
        [analysis_for(item, status=SUCCEEDED, created_at=T0) for item in (newest, oldest, french)]
    )

    spanish = await _analysed(db_session, language="es")
    every = await _analysed(db_session)

    assert [row.entry_id for row in spanish] == [oldest.id, newest.id]
    assert [row.entry_id for row in every] == [oldest.id, french.id, newest.id]


async def test_the_text_is_the_analysed_snapshot_not_a_later_edit(db_session: AsyncSession) -> None:
    entry = entry_at(T0, text="Hola  mundo\nqué\ttal")
    db_session.add(analysis_for(entry, status=SUCCEEDED, created_at=T0))
    await db_session.flush()
    entry.text, entry.word_count = "Hola", 1

    [row] = await _analysed(db_session)

    assert row.input_text == "Hola  mundo\nqué\ttal"

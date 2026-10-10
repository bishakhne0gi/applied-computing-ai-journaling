import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Analysis, AnalysisStatus, Entry, Mistake
from journal_ai import Category, FailureCode, MistakeKind


def _entry(language: str = "es") -> Entry:
    return Entry(language=language, text="Ayer yo es feliz.", word_count=4)


async def test_an_entry_analysis_and_mistakes_round_trip(db_session: AsyncSession) -> None:
    entry = _entry()
    analysis = Analysis(
        entry=entry,
        status=AnalysisStatus.SUCCEEDED,
        input_text=entry.text,
        prompt_version="v1",
        model="fake",
        error_code=None,
        mistakes=[
            Mistake(
                kind=MistakeKind.ERROR,
                category=Category.VERB_CONJUGATION,
                original="yo es",
                correction="yo soy",
                explanation="Ser with yo is soy.",
                start_offset=5,
                end_offset=10,
                position=0,
            )
        ],
    )
    db_session.add(analysis)
    await db_session.flush()
    db_session.expunge_all()

    stored = await db_session.scalar(select(Analysis).where(Analysis.id == analysis.id))

    assert stored is not None
    assert stored.status is AnalysisStatus.SUCCEEDED
    assert stored.mistakes[0].category is Category.VERB_CONJUGATION
    assert stored.mistakes[0].start_offset == 5
    assert stored.created_at.tzinfo is not None


async def test_unsupported_languages_are_rejected_by_the_database(db_session: AsyncSession) -> None:
    db_session.add(_entry(language="xx"))

    with pytest.raises(IntegrityError):
        await db_session.flush()


async def test_failure_codes_are_stored_as_their_values(db_session: AsyncSession) -> None:
    entry = _entry()
    analysis = Analysis(
        entry=entry,
        status=AnalysisStatus.FAILED,
        input_text=entry.text,
        prompt_version="v1",
        error_code=FailureCode.PROVIDER_TIMEOUT,
        mistakes=[],
    )
    db_session.add(analysis)
    await db_session.flush()

    raw = await db_session.scalar(text("SELECT error_code FROM analyses WHERE id = :id"), {"id": analysis.id})

    assert raw == "provider_timeout"
    assert type(raw) is str


async def test_deleting_an_entry_cascades_to_its_analyses_and_mistakes(db_session: AsyncSession) -> None:
    entry = _entry()
    db_session.add(
        Analysis(
            entry=entry,
            status=AnalysisStatus.PENDING,
            input_text=entry.text,
            prompt_version="v1",
            mistakes=[
                Mistake(
                    kind=MistakeKind.ERROR,
                    category=Category.OTHER,
                    original="x",
                    correction="y",
                    explanation="z",
                    position=0,
                )
            ],
        )
    )
    await db_session.flush()

    await db_session.delete(entry)
    await db_session.flush()

    assert await db_session.scalar(select(Analysis.id)) is None
    assert await db_session.scalar(select(Mistake.id)) is None


async def test_unknown_enum_values_are_rejected_by_the_database(db_session: AsyncSession) -> None:
    entry = _entry()
    db_session.add(
        Analysis(
            entry=entry,
            status=AnalysisStatus.PENDING,
            input_text=entry.text,
            prompt_version="v1",
            mistakes=[],
        )
    )
    await db_session.flush()

    with pytest.raises(IntegrityError):
        await db_session.execute(text("UPDATE analyses SET status = 'bogus'"))

from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AnalysisStatus
from app.repositories.analyses import AnalysisRepository, AnalysisSummary
from app.repositories.entries import EntryCursor, EntryRepository
from tests.support import analysis_for, entry_at

T0 = datetime(2026, 10, 1, 9, 0, tzinfo=UTC)


async def test_list_page_is_newest_first_and_filters_by_language(db_session: AsyncSession) -> None:
    older, newer, french = entry_at(T0), entry_at(T0 + timedelta(hours=1)), entry_at(T0, language="fr")
    db_session.add_all([older, newer, french])
    await db_session.flush()

    page = await EntryRepository(db_session).list_page(language="es", before=None, limit=10)

    assert [e.id for e in page] == [newer.id, older.id]


async def test_list_page_continues_after_the_cursor(db_session: AsyncSession) -> None:
    entries = [entry_at(T0 + timedelta(minutes=i)) for i in range(3)]
    db_session.add_all(entries)
    await db_session.flush()
    repo = EntryRepository(db_session)

    first = await repo.list_page(language=None, before=None, limit=2)
    rest = await repo.list_page(
        language=None, before=EntryCursor(first[-1].created_at, first[-1].id), limit=2
    )

    assert [e.id for e in first] == [entries[2].id, entries[1].id]
    assert [e.id for e in rest] == [entries[0].id]


async def test_list_page_breaks_timestamp_ties_by_id(db_session: AsyncSession) -> None:
    twins = [entry_at(T0), entry_at(T0)]
    db_session.add_all(twins)
    await db_session.flush()
    repo = EntryRepository(db_session)

    first = await repo.list_page(language=None, before=None, limit=1)
    second = await repo.list_page(
        language=None, before=EntryCursor(first[0].created_at, first[0].id), limit=1
    )

    assert [first[0].id, second[0].id] == sorted((t.id for t in twins), reverse=True)


async def test_latest_for_entry_returns_the_newest_analysis_with_mistakes(db_session: AsyncSession) -> None:
    entry = entry_at(T0)
    db_session.add_all(
        [
            analysis_for(entry, status=AnalysisStatus.FAILED, created_at=T0),
            analysis_for(
                entry, status=AnalysisStatus.SUCCEEDED, created_at=T0 + timedelta(minutes=5), errors=2
            ),
        ]
    )
    await db_session.flush()
    db_session.expunge_all()

    latest = await AnalysisRepository(db_session).latest_for_entry(entry.id)

    assert latest is not None
    assert latest.status is AnalysisStatus.SUCCEEDED
    assert len(latest.mistakes) == 2


async def test_list_for_entry_is_newest_first(db_session: AsyncSession) -> None:
    entry = entry_at(T0)
    first = analysis_for(entry, status=AnalysisStatus.FAILED, created_at=T0)
    second = analysis_for(entry, status=AnalysisStatus.SUCCEEDED, created_at=T0 + timedelta(minutes=1))
    db_session.add_all([first, second])
    await db_session.flush()

    history = await AnalysisRepository(db_session).list_for_entry(entry.id)

    assert [a.id for a in history] == [second.id, first.id]


async def test_latest_summaries_count_only_errors_of_the_latest_analysis(db_session: AsyncSession) -> None:
    analysed, failed, untouched = entry_at(T0), entry_at(T0), entry_at(T0)
    db_session.add_all(
        [
            analysis_for(analysed, status=AnalysisStatus.SUCCEEDED, created_at=T0, errors=5),
            analysis_for(
                analysed,
                status=AnalysisStatus.SUCCEEDED,
                created_at=T0 + timedelta(minutes=1),
                errors=1,
                suggestions=3,
            ),
            analysis_for(failed, status=AnalysisStatus.FAILED, created_at=T0),
            untouched,
        ]
    )
    await db_session.flush()

    summaries = await AnalysisRepository(db_session).latest_summaries([analysed.id, failed.id, untouched.id])

    assert summaries == {
        analysed.id: AnalysisSummary(status=AnalysisStatus.SUCCEEDED, error_count=1),
        failed.id: AnalysisSummary(status=AnalysisStatus.FAILED, error_count=0),
    }


async def test_latest_summaries_break_created_at_ties_by_higher_id(db_session: AsyncSession) -> None:
    entry = entry_at(T0)
    twins = [
        analysis_for(entry, status=AnalysisStatus.SUCCEEDED, created_at=T0, errors=1),
        analysis_for(entry, status=AnalysisStatus.FAILED, created_at=T0),
    ]
    db_session.add_all(twins)
    await db_session.flush()
    winner = max(twins, key=lambda a: a.id)

    summaries = await AnalysisRepository(db_session).latest_summaries([entry.id])

    assert summaries[entry.id].status is winner.status


async def test_latest_summaries_of_no_entries_is_empty(db_session: AsyncSession) -> None:
    assert await AnalysisRepository(db_session).latest_summaries([]) == {}

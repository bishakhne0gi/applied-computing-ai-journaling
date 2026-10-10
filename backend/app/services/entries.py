import uuid
from dataclasses import dataclass

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.db.models import Analysis, AnalysisStatus, Entry
from app.repositories.analyses import AnalysisRepository
from app.repositories.entries import EntryCursor, EntryRepository
from journal_ai import normalize_text

logger = structlog.get_logger()


def count_words(text: str) -> int:
    return len(text.split())


@dataclass(frozen=True)
class EntrySummary:
    entry: Entry
    latest_status: AnalysisStatus | None
    error_count: int


@dataclass(frozen=True)
class EntryPage:
    items: list[EntrySummary]
    next_cursor: EntryCursor | None


class EntryService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._entries = EntryRepository(session)
        self._analyses = AnalysisRepository(session)

    async def create(self, *, language: str, text: str) -> Entry:
        normalized = normalize_text(text)
        entry = Entry(language=language, text=normalized, word_count=count_words(normalized))
        self._entries.add(entry)
        await self._session.commit()
        logger.info("entry_created", entry_id=str(entry.id), language=language, word_count=entry.word_count)
        return entry

    async def get(self, entry_id: uuid.UUID) -> Entry:
        entry = await self._entries.get(entry_id)
        if entry is None:
            raise NotFoundError(f"Entry {entry_id} not found")
        return entry

    async def get_detail(self, entry_id: uuid.UUID) -> tuple[Entry, Analysis | None]:
        entry = await self.get(entry_id)
        return entry, await self._analyses.latest_for_entry(entry_id)

    async def update_text(self, entry_id: uuid.UUID, text: str) -> Entry:
        entry = await self.get(entry_id)
        entry.text = normalize_text(text)
        entry.word_count = count_words(entry.text)
        await self._session.commit()
        logger.info("entry_updated", entry_id=str(entry.id), word_count=entry.word_count)
        return entry

    async def list_page(self, *, language: str | None, cursor: EntryCursor | None, limit: int) -> EntryPage:
        # One extra row tells us whether another page exists without a COUNT query.
        rows = await self._entries.list_page(language=language, before=cursor, limit=limit + 1)
        entries, has_more = rows[:limit], len(rows) > limit
        summaries = await self._analyses.latest_summaries([e.id for e in entries])
        items = [
            EntrySummary(
                entry=e,
                latest_status=summaries[e.id].status if e.id in summaries else None,
                error_count=summaries[e.id].error_count if e.id in summaries else 0,
            )
            for e in entries
        ]
        last = entries[-1] if has_more else None
        return EntryPage(items=items, next_cursor=EntryCursor(last.created_at, last.id) if last else None)

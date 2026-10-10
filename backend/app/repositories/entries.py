import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Entry


@dataclass(frozen=True)
class EntryCursor:
    created_at: datetime
    id: uuid.UUID


class EntryRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def add(self, entry: Entry) -> None:
        self._session.add(entry)

    async def get(self, entry_id: uuid.UUID) -> Entry | None:
        return await self._session.get(Entry, entry_id)

    async def list_page(self, *, language: str | None, before: EntryCursor | None, limit: int) -> list[Entry]:
        stmt = select(Entry).order_by(Entry.created_at.desc(), Entry.id.desc()).limit(limit)
        if language is not None:
            stmt = stmt.where(Entry.language == language)
        if before is not None:
            stmt = stmt.where(tuple_(Entry.created_at, Entry.id) < tuple_(before.created_at, before.id))
        return list((await self._session.scalars(stmt)).all())

import unicodedata
import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.services.entries import EntryService, count_words


@pytest.mark.parametrize(("text", "expected"), [("Hola mundo", 2), ("  uno\n dos\ttres ", 3), ("¡Hola!", 1)])
def test_count_words_splits_on_any_whitespace(text: str, expected: int) -> None:
    assert count_words(text) == expected


async def test_create_normalises_and_counts_words(db_session: AsyncSession) -> None:
    text = unicodedata.normalize("NFD", "  Él está en el café.\r\nAdiós ")

    entry = await EntryService(db_session).create(language="es", text=text)

    assert entry.text == "Él está en el café.\nAdiós"
    assert entry.text == unicodedata.normalize("NFC", entry.text)
    assert entry.word_count == 6
    assert entry.id is not None


async def test_get_unknown_entry_raises_not_found(db_session: AsyncSession) -> None:
    with pytest.raises(NotFoundError):
        await EntryService(db_session).get(uuid.uuid4())


async def test_update_text_renormalises_and_recounts(db_session: AsyncSession) -> None:
    service = EntryService(db_session)
    entry = await service.create(language="es", text="Hola")

    updated = await service.update_text(entry.id, "Hola de nuevo\r\n")

    assert updated.text == "Hola de nuevo"
    assert updated.word_count == 3
    assert updated.updated_at >= entry.created_at


async def test_list_page_returns_a_cursor_only_when_more_entries_exist(db_session: AsyncSession) -> None:
    service = EntryService(db_session)
    for text in ("uno", "dos", "tres"):
        await service.create(language="es", text=text)

    first = await service.list_page(language=None, cursor=None, limit=2)
    second = await service.list_page(language=None, cursor=first.next_cursor, limit=2)

    assert [s.entry.text for s in first.items] == ["tres", "dos"]
    assert first.next_cursor is not None
    assert [s.entry.text for s in second.items] == ["uno"]
    assert second.next_cursor is None
    assert first.items[0].latest_status is None
    assert first.items[0].error_count == 0

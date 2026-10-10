import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.cursor import decode_cursor, encode_cursor
from app.api.deps import EntryServiceDep
from app.api.schemas.analyses import AnalysisOut
from app.api.schemas.entries import (
    EntryCreate,
    EntryDetailOut,
    EntryOut,
    EntryPageOut,
    EntrySummaryOut,
    EntryUpdate,
    LanguageCode,
)
from app.services.entries import EntrySummary

router = APIRouter(prefix="/entries", tags=["entries"])
PREVIEW_LENGTH = 140


@router.post("", status_code=status.HTTP_201_CREATED, response_model=EntryOut)
async def create_entry(body: EntryCreate, service: EntryServiceDep) -> EntryOut:
    entry = await service.create(language=body.language, text=body.text)
    return EntryOut.model_validate(entry)


@router.get("", response_model=EntryPageOut)
async def list_entries(
    service: EntryServiceDep,
    language: Annotated[LanguageCode | None, Query()] = None,
    cursor: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> EntryPageOut:
    page = await service.list_page(
        language=language, cursor=decode_cursor(cursor) if cursor else None, limit=limit
    )
    return EntryPageOut(
        items=[_summary(item) for item in page.items],
        next_cursor=encode_cursor(page.next_cursor) if page.next_cursor else None,
    )


@router.get("/{entry_id}", response_model=EntryDetailOut)
async def get_entry(entry_id: uuid.UUID, service: EntryServiceDep) -> EntryDetailOut:
    entry, latest = await service.get_detail(entry_id)
    return EntryDetailOut.model_validate(
        {
            **EntryOut.model_validate(entry).model_dump(),
            "latest_analysis": AnalysisOut.model_validate(latest) if latest else None,
        }
    )


@router.patch("/{entry_id}", response_model=EntryOut)
async def update_entry(entry_id: uuid.UUID, body: EntryUpdate, service: EntryServiceDep) -> EntryOut:
    return EntryOut.model_validate(await service.update_text(entry_id, body.text))


def _summary(item: EntrySummary) -> EntrySummaryOut:
    text = item.entry.text
    preview = text if len(text) <= PREVIEW_LENGTH else text[:PREVIEW_LENGTH].rstrip() + "…"
    return EntrySummaryOut(
        id=item.entry.id,
        language=item.entry.language,
        preview=preview,
        word_count=item.entry.word_count,
        created_at=item.entry.created_at,
        latest_status=item.latest_status,
        error_count=item.error_count,
    )

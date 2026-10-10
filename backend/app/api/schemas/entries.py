import uuid
from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, StringConstraints

from app.api.schemas.analyses import AnalysisOut
from app.db.models import AnalysisStatus
from journal_ai import SUPPORTED_LANGUAGES


def _supported(code: str) -> str:
    if code not in SUPPORTED_LANGUAGES:
        raise ValueError(f"Unsupported language: {code}")
    return code


LanguageCode = Annotated[str, AfterValidator(_supported)]
EntryText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)]


class EntryCreate(BaseModel):
    language: LanguageCode
    text: EntryText


class EntryUpdate(BaseModel):
    text: EntryText


class EntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    language: str
    text: str
    word_count: int
    created_at: datetime
    updated_at: datetime


class EntryDetailOut(EntryOut):
    latest_analysis: AnalysisOut | None


class EntrySummaryOut(BaseModel):
    id: uuid.UUID
    language: str
    preview: str
    word_count: int
    created_at: datetime
    latest_status: AnalysisStatus | None
    error_count: int


class EntryPageOut(BaseModel):
    items: list[EntrySummaryOut]
    next_cursor: str | None

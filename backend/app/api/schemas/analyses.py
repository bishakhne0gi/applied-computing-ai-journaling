import uuid
from datetime import datetime

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from app.db.models import AnalysisStatus
from journal_ai import Category, FailureCode, MistakeKind


class MistakeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    kind: MistakeKind
    category: Category
    original: str
    correction: str
    explanation: str
    start: int | None = Field(validation_alias=AliasChoices("start_offset", "start"))
    end: int | None = Field(validation_alias=AliasChoices("end_offset", "end"))


class AnalysisOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    entry_id: uuid.UUID
    status: AnalysisStatus
    input_text: str
    corrected_text: str | None
    feedback_summary: str | None
    model: str | None
    prompt_version: str
    error_code: FailureCode | None
    latency_ms: int | None
    created_at: datetime
    completed_at: datetime | None
    mistakes: list[MistakeOut]

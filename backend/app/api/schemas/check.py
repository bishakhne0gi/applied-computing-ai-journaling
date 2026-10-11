from pydantic import BaseModel, ConfigDict

from app.api.schemas.entries import EntryText, LanguageCode
from journal_ai import Category, MistakeKind


class CheckRequest(BaseModel):
    language: LanguageCode
    text: EntryText


class HintOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    kind: MistakeKind
    category: Category
    original: str
    correction: str
    explanation: str
    start: int | None
    end: int | None


class CheckOut(BaseModel):
    # Offsets are code points into this text (normalised like an analysis), not into what the client sent.
    analyzed_text: str
    hints: list[HintOut]

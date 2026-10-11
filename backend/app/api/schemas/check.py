from pydantic import BaseModel, ConfigDict, Field

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
    start: int | None = Field(
        description="Unicode code-point offset into analyzed_text, not UTF-16 units or the request text."
    )
    end: int | None = Field(description="Exclusive code-point offset into analyzed_text.")


class CheckOut(BaseModel):
    analyzed_text: str = Field(
        description=(
            "The NFC-normalised, trimmed text that hint offsets index. It can differ from the request text; "
            "clients map offsets into their own string units and re-anchor by `original`."
        )
    )
    hints: list[HintOut]

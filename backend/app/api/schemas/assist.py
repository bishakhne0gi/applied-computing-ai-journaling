from typing import Annotated, Self

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator

from app.api.schemas.entries import LanguageCode
from app.services.entries import count_words
from app.services.writing_assist import MIN_WORDS
from journal_ai import Tone, normalize_text

MAX_SPAN = 500
# Not stripped: /rephrase offsets point into it and /complete needs its trailing whitespace.
AssistText = Annotated[str, StringConstraints(min_length=1, max_length=5000)]


class RephraseRequest(BaseModel):
    language: LanguageCode
    text: AssistText
    start: int = Field(ge=0)
    end: int = Field(gt=0)

    @model_validator(mode="after")
    def _span_is_a_sentence_of_the_normalised_text(self) -> Self:
        # Offsets are code points into exactly this text, so the server cannot normalise it after the fact.
        if normalize_text(self.text) != self.text:
            raise ValueError("text must be normalised (NFC, LF line ends, trimmed)")
        if not self.start < self.end <= len(self.text):
            raise ValueError("start and end must be a span inside text")
        span = self.text[self.start : self.end]
        if len(span) > MAX_SPAN or count_words(span) < MIN_WORDS:
            raise ValueError(
                f"the span must hold {MIN_WORDS} or more words and at most {MAX_SPAN} characters"
            )
        return self


class CompleteRequest(BaseModel):
    language: LanguageCode
    text: AssistText

    @field_validator("text")
    @classmethod
    def _not_blank(cls, text: str) -> str:
        if not text.strip():
            raise ValueError("text must not be blank")
        return text


class VersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    text: str
    tone: Tone
    label: str
    explanation: str


class AlternativeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    word: str
    nuance: str


class VocabularyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    original: str
    start: int = Field(description="Unicode code-point offset into sentence.")
    end: int = Field(description="Exclusive code-point offset into sentence.")
    alternatives: list[AlternativeOut]


class RephraseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sentence: str = Field(description="`text[start:end]`; compare before applying.")
    versions: list[VersionOut]
    vocabulary: list[VocabularyOut]


class CompleteOut(BaseModel):
    completion: str

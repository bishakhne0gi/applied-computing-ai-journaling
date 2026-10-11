from enum import StrEnum
from typing import Any, Self

from pydantic import BaseModel, ConfigDict, Field


class MistakeKind(StrEnum):
    ERROR = "error"
    SUGGESTION = "suggestion"
    VOCAB_HELP = "vocab_help"


class Category(StrEnum):
    VERB_CONJUGATION = "verb_conjugation"
    VERB_TENSE = "verb_tense"
    GENDER_AGREEMENT = "gender_agreement"
    NUMBER_AGREEMENT = "number_agreement"
    ARTICLE = "article"
    PREPOSITION = "preposition"
    WORD_ORDER = "word_order"
    SPELLING = "spelling"
    VOCABULARY = "vocabulary"
    PUNCTUATION = "punctuation"
    OTHER = "other"


class Mistake(BaseModel):
    model_config = ConfigDict(frozen=True, str_strip_whitespace=True)

    kind: MistakeKind
    category: Category
    original: str = Field(min_length=1)
    correction: str
    explanation: str = Field(min_length=1)


class AlignedMistake(Mistake):
    start: int | None = None
    end: int | None = None


class AnalysisResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    corrected_text: str
    feedback_summary: str
    mistakes: tuple[AlignedMistake, ...]


class Usage(BaseModel):
    model_config = ConfigDict(frozen=True)

    input_tokens: int = 0
    output_tokens: int = 0

    def __add__(self, other: Self) -> Self:
        return type(self)(
            input_tokens=self.input_tokens + other.input_tokens,
            output_tokens=self.output_tokens + other.output_tokens,
        )


class FailureCode(StrEnum):
    PROVIDER_TIMEOUT = "provider_timeout"
    INVALID_OUTPUT = "invalid_output"
    PROVIDER_ERROR = "provider_error"


class AnalysisOutcome(BaseModel):
    model_config = ConfigDict(frozen=True)

    result: AnalysisResult | None
    analyzed_text: str
    failure: FailureCode | None
    raw_response: str | None
    model: str
    prompt_version: str
    usage: Usage
    latency_ms: int
    retried: bool
    dropped_mistakes: int
    error_detail: str | None = None

    @property
    def succeeded(self) -> bool:
        return self.result is not None


RESPONSE_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["corrected_text", "feedback_summary", "mistakes"],
    "properties": {
        "corrected_text": {"type": "string"},
        "feedback_summary": {"type": "string"},
        "mistakes": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["kind", "category", "original", "correction", "explanation"],
                "properties": {
                    "kind": {"type": "string", "enum": [k.value for k in MistakeKind]},
                    "category": {"type": "string", "enum": [c.value for c in Category]},
                    "original": {"type": "string"},
                    "correction": {"type": "string"},
                    "explanation": {"type": "string"},
                },
            },
        },
    },
}


class Tone(StrEnum):
    NATURAL = "natural"
    FORMAL = "formal"
    CASUAL = "casual"
    SIMPLER = "simpler"


class Version(BaseModel):
    model_config = ConfigDict(frozen=True, str_strip_whitespace=True)

    text: str = Field(min_length=1)
    tone: Tone
    label: str = Field(min_length=1)
    explanation: str = Field(min_length=1)


class Alternative(BaseModel):
    model_config = ConfigDict(frozen=True, str_strip_whitespace=True)

    word: str = Field(min_length=1)
    nuance: str = Field(min_length=1)


class VocabularyItem(BaseModel):
    model_config = ConfigDict(frozen=True, str_strip_whitespace=True)

    original: str = Field(min_length=1)
    start: int
    end: int
    alternatives: tuple[Alternative, ...]


class Rephrasing(BaseModel):
    model_config = ConfigDict(frozen=True)

    sentence: str
    versions: tuple[Version, ...]
    vocabulary: tuple[VocabularyItem, ...]


class RephraseOutcome(BaseModel):
    model_config = ConfigDict(frozen=True)

    result: Rephrasing | None
    failure: FailureCode | None
    model: str
    latency_ms: int
    usage: Usage


class CompletionOutcome(BaseModel):
    model_config = ConfigDict(frozen=True)

    completion: str | None
    failure: FailureCode | None
    model: str
    latency_ms: int
    usage: Usage


REPHRASE_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["versions", "vocabulary"],
    "properties": {
        "versions": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["text", "tone", "label", "explanation"],
                "properties": {
                    "text": {"type": "string"},
                    "tone": {"type": "string", "enum": [t.value for t in Tone]},
                    "label": {"type": "string"},
                    "explanation": {"type": "string"},
                },
            },
        },
        "vocabulary": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["original", "alternatives"],
                "properties": {
                    "original": {"type": "string"},
                    "alternatives": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": ["word", "nuance"],
                            "properties": {"word": {"type": "string"}, "nuance": {"type": "string"}},
                        },
                    },
                },
            },
        },
    },
}

COMPLETION_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["completion"],
    "properties": {"completion": {"type": "string"}},
}

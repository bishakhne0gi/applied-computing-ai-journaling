import json
import re
from dataclasses import dataclass
from typing import Any

from pydantic import ValidationError

from journal_ai.schema import Category, Mistake, MistakeKind


class InvalidOutputError(Exception):
    pass


@dataclass(frozen=True)
class ParsedAnalysis:
    corrected_text: str
    feedback_summary: str
    mistakes: tuple[Mistake, ...]
    dropped: int


def parse_analysis(raw: str) -> ParsedAnalysis:
    payload = load_json_object(raw, _REQUIRED_KEYS)
    corrected = payload.get("corrected_text")
    summary = payload.get("feedback_summary")
    items = payload.get("mistakes")
    if not isinstance(corrected, str) or not isinstance(summary, str) or not isinstance(items, list):
        raise InvalidOutputError("corrected_text, feedback_summary and mistakes are required")

    mistakes = tuple(m for m in (_parse_mistake(item) for item in items) if m is not None)
    return ParsedAnalysis(corrected.strip(), summary.strip(), mistakes, dropped=len(items) - len(mistakes))


_REQUIRED_KEYS = frozenset({"corrected_text", "feedback_summary", "mistakes"})


def load_json_object(raw: str, required: frozenset[str]) -> dict[str, Any]:
    # Try every "{" so prose with braces, or a second object, cannot hide the real payload.
    decoder = json.JSONDecoder()
    error = "no JSON object found"
    start = raw.find("{")
    while start != -1:
        try:
            payload, _ = decoder.raw_decode(raw, start)
        except json.JSONDecodeError as exc:
            error = f"invalid JSON: {exc.msg}"
        except RecursionError:
            raise InvalidOutputError("JSON nested too deeply") from None
        else:
            if isinstance(payload, dict) and payload.keys() >= required:
                return payload
            error = f"{', '.join(sorted(required))} required"
        start = raw.find("{", start + 1)
    raise InvalidOutputError(error)


def _parse_mistake(item: Any) -> Mistake | None:
    if not isinstance(item, dict):
        return None
    try:
        mistake = Mistake.model_validate(
            {
                **item,
                "kind": _normalise(item.get("kind")),
                "category": _coerce_category(item.get("category")),
            }
        )
    except ValidationError:
        return None
    if mistake.original == mistake.correction:
        return None
    if mistake.kind is MistakeKind.VOCAB_HELP:
        return mistake.model_copy(update={"category": Category.VOCABULARY})
    return mistake


def _normalise(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    return re.sub(r"[\s-]+", "_", value.strip().lower())


def _coerce_category(value: Any) -> Category:
    key = _normalise(value)
    if not isinstance(key, str):
        return Category.OTHER
    try:
        return Category(key)
    except ValueError:
        return Category.OTHER

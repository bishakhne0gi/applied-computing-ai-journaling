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
    payload = _load_json_object(raw)
    corrected = payload.get("corrected_text")
    summary = payload.get("feedback_summary")
    items = payload.get("mistakes")
    if not isinstance(corrected, str) or not isinstance(summary, str) or not isinstance(items, list):
        raise InvalidOutputError("corrected_text, feedback_summary and mistakes are required")

    mistakes = tuple(m for m in (_parse_mistake(item) for item in items) if m is not None)
    return ParsedAnalysis(corrected.strip(), summary.strip(), mistakes, dropped=len(items) - len(mistakes))


def _load_json_object(raw: str) -> dict[str, Any]:
    # Slicing from the first "{" to the last "}" tolerates code fences and prose around the JSON.
    start, end = raw.find("{"), raw.rfind("}")
    if start == -1 or end <= start:
        raise InvalidOutputError("no JSON object found")
    try:
        payload = json.loads(raw[start : end + 1])
    except json.JSONDecodeError as exc:
        raise InvalidOutputError(f"invalid JSON: {exc.msg}") from exc
    if not isinstance(payload, dict):
        raise InvalidOutputError("top-level JSON must be an object")
    return payload


def _parse_mistake(item: Any) -> Mistake | None:
    if not isinstance(item, dict):
        return None
    try:
        mistake = Mistake.model_validate({**item, "category": _coerce_category(item.get("category"))})
    except ValidationError:
        return None
    if mistake.original == mistake.correction:
        return None
    if mistake.kind is MistakeKind.VOCAB_HELP:
        return mistake.model_copy(update={"category": Category.VOCABULARY})
    return mistake


def _coerce_category(value: Any) -> Category:
    if not isinstance(value, str):
        return Category.OTHER
    key = re.sub(r"[\s-]+", "_", value.strip().lower())
    try:
        return Category(key)
    except ValueError:
        return Category.OTHER

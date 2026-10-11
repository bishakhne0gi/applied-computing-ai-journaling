import unicodedata
from typing import Any

from pydantic import BaseModel, ValidationError

from journal_ai.alignment import find_word_span
from journal_ai.parsing import InvalidOutputError, load_json_object
from journal_ai.schema import Alternative, Rephrasing, Version, VocabularyItem

MAX_VERSIONS = 3
MAX_VOCABULARY = 4
MAX_ALTERNATIVES = 3
MAX_COMPLETION_WORDS = 8
MAX_COMPLETION_CHARS = 120


def parse_rephrasing(raw: str, sentence: str) -> Rephrasing:
    payload = load_json_object(raw, frozenset({"versions", "vocabulary"}))
    versions = _versions(payload["versions"], sentence)
    if not versions:
        raise InvalidOutputError("no usable version")
    return Rephrasing(
        sentence=sentence,
        versions=versions[:MAX_VERSIONS],
        vocabulary=_vocabulary(payload["vocabulary"], sentence),
    )


def finish_completion(prefix: str, raw: str) -> str:
    value = load_json_object(raw, frozenset({"completion"}))["completion"]
    if not isinstance(value, str):
        raise InvalidOutputError("completion must be a string")
    line = unicodedata.normalize("NFC", value).split("\n", 1)[0]
    body = " ".join(line.split()[:MAX_COMPLETION_WORDS])
    if not body:
        return ""
    # A leading space starts a new word; none finishes the word in progress. After whitespace: never.
    lead = " " if line[:1].isspace() and not prefix[-1:].isspace() else ""
    return (lead + body)[:MAX_COMPLETION_CHARS].rstrip()


def _key(text: str) -> str:
    return unicodedata.normalize("NFC", text).strip().casefold()


def _first_line(value: Any) -> Any:
    return value.strip().split("\n", 1)[0] if isinstance(value, str) else value


def _validate[M: BaseModel](model: type[M], item: Any) -> M | None:
    if not isinstance(item, dict):
        return None
    try:
        return model.model_validate(item)
    except ValidationError:
        return None


def _versions(items: object, sentence: str) -> tuple[Version, ...]:
    seen = {_key(sentence)}
    kept: list[Version] = []
    for item in items if isinstance(items, list) else []:
        one_line = {**item, "text": _first_line(item.get("text"))} if isinstance(item, dict) else item
        version = _validate(Version, one_line)
        if version is not None and _key(version.text) not in seen:
            seen.add(_key(version.text))
            kept.append(version)
    return tuple(kept)


def _vocabulary(items: object, sentence: str) -> tuple[VocabularyItem, ...]:
    placed: list[VocabularyItem] = []
    for item in items if isinstance(items, list) else []:
        candidate = _vocabulary_item(item, sentence)
        if candidate and not any(candidate.start < p.end and p.start < candidate.end for p in placed):
            placed.append(candidate)
    return tuple(sorted(placed, key=lambda i: i.start)[:MAX_VOCABULARY])


def _vocabulary_item(item: Any, sentence: str) -> VocabularyItem | None:
    if not isinstance(item, dict) or not isinstance(item.get("original"), str):
        return None
    original = item["original"].strip()
    span = find_word_span(sentence, original)
    if span is None:
        return None
    alternatives = _alternatives(item.get("alternatives"), original)
    if not alternatives:
        return None
    return VocabularyItem(
        original=sentence[span[0] : span[1]], start=span[0], end=span[1], alternatives=alternatives
    )


def _alternatives(items: object, original: str) -> tuple[Alternative, ...]:
    kept: list[Alternative] = []
    for item in items if isinstance(items, list) else []:
        alternative = _validate(Alternative, item)
        if alternative is not None and _key(alternative.word) != _key(original):
            kept.append(alternative)
    return tuple(kept[:MAX_ALTERNATIVES])

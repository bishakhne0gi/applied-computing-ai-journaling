import base64
import uuid
from datetime import UTC, datetime

import pytest

from app.api.cursor import InvalidCursorError, decode_cursor, encode_cursor
from app.repositories.entries import EntryCursor


def test_cursors_round_trip() -> None:
    cursor = EntryCursor(datetime(2026, 10, 1, 9, 30, 15, 123456, tzinfo=UTC), uuid.uuid4())

    assert decode_cursor(encode_cursor(cursor)) == cursor


def test_encoded_cursors_are_url_safe() -> None:
    raw = encode_cursor(EntryCursor(datetime(2026, 10, 1, tzinfo=UTC), uuid.uuid4()))

    assert set(raw) <= set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_")


def _raw(payload: str) -> str:
    return base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "not-base64!",
        "e30",
        "eyJjIjogMX0",
        "aGVsbG8",
        _raw(f'{{"c": "2026-10-01T09:00:00", "i": "{uuid.uuid4()}"}}'),
        _raw("[" * 100_000),
    ],
    ids=["empty", "not-base64", "empty-object", "bad-fields", "not-json", "naive-datetime", "deeply-nested"],
)
def test_garbage_cursors_are_rejected(raw: str) -> None:
    with pytest.raises(InvalidCursorError):
        decode_cursor(raw)

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


@pytest.mark.parametrize("raw", ["", "not-base64!", "e30", "eyJjIjogMX0", "aGVsbG8"])
def test_garbage_cursors_are_rejected(raw: str) -> None:
    with pytest.raises(InvalidCursorError):
        decode_cursor(raw)

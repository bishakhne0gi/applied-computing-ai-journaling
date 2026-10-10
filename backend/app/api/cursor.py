import base64
import binascii
import json
import uuid
from datetime import datetime
from http import HTTPStatus

from app.core.errors import AppError
from app.repositories.entries import EntryCursor


class InvalidCursorError(AppError):
    status_code = HTTPStatus.BAD_REQUEST
    title = "Bad Request"


def encode_cursor(cursor: EntryCursor) -> str:
    payload = json.dumps({"c": cursor.created_at.isoformat(), "i": str(cursor.id)})
    return base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")


def decode_cursor(raw: str) -> EntryCursor:
    try:
        padded = raw + "=" * (-len(raw) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded.encode()))
        created_at = datetime.fromisoformat(payload["c"])
        # A naive timestamp would fail later against timestamptz comparisons, so reject it here as a 400.
        if created_at.tzinfo is None:
            raise InvalidCursorError("Invalid cursor")
        return EntryCursor(created_at=created_at, id=uuid.UUID(payload["i"]))
    except (binascii.Error, UnicodeDecodeError, ValueError, KeyError, TypeError, RecursionError) as exc:
        raise InvalidCursorError("Invalid cursor") from exc

import re
import time
import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

REQUEST_ID_HEADER = "X-Request-ID"
# Incoming ids end up in logs and response headers, so only short, plain tokens are trusted.
_SAFE_REQUEST_ID = re.compile(r"[A-Za-z0-9-]{1,64}")

logger = structlog.get_logger()


def _request_id_from(request: Request) -> str:
    incoming = request.headers.get(REQUEST_ID_HEADER, "")
    return incoming if _SAFE_REQUEST_ID.fullmatch(incoming) else uuid.uuid4().hex


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = _request_id_from(request)
        request.state.request_id = request_id
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        started = time.perf_counter()
        response = await call_next(request)
        response.headers[REQUEST_ID_HEADER] = request_id
        logger.info(
            "request",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=round((time.perf_counter() - started) * 1000, 1),
        )
        return response

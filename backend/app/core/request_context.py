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


def _log_request(request: Request, request_id: str, status: int, started: float) -> None:
    logger.info(
        "request",
        request_id=request_id,
        method=request.method,
        path=request.url.path,
        status=status,
        duration_ms=round((time.perf_counter() - started) * 1000, 1),
    )


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = _request_id_from(request)
        request.state.request_id = request_id
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            # The 500 body is built outside this middleware, but the request must still leave a log line.
            _log_request(request, request_id, 500, started)
            raise
        response.headers[REQUEST_ID_HEADER] = request_id
        _log_request(request, request_id, response.status_code, started)
        return response

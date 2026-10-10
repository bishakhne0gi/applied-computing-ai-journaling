from http import HTTPStatus
from typing import Any

import structlog
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.request_context import REQUEST_ID_HEADER

PROBLEM_JSON = "application/problem+json"
logger = structlog.get_logger()


class AppError(Exception):
    status_code: HTTPStatus = HTTPStatus.INTERNAL_SERVER_ERROR
    title: str = "Internal Server Error"

    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class NotFoundError(AppError):
    status_code = HTTPStatus.NOT_FOUND
    title = "Not Found"


def problem(request: Request, status: int, title: str, detail: str, **extra: Any) -> JSONResponse:
    request_id: str | None = getattr(request.state, "request_id", None)
    body = {
        "type": "about:blank",
        "title": title,
        "status": status,
        "detail": detail,
        "instance": request.url.path,
        "request_id": request_id,
        **extra,
    }
    headers = {REQUEST_ID_HEADER: request_id} if request_id else None
    return JSONResponse(body, status_code=status, media_type=PROBLEM_JSON, headers=headers)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        return problem(request, exc.status_code, exc.title, exc.detail)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        # Only location, message and type: echoing `input` would put journal text into responses and logs.
        errors = [{"loc": list(e["loc"]), "msg": e["msg"], "type": e["type"]} for e in exc.errors()]
        return problem(request, 422, "Unprocessable Content", "Request validation failed", errors=errors)

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        return problem(request, exc.status_code, HTTPStatus(exc.status_code).phrase, str(exc.detail))

    @app.exception_handler(Exception)
    async def handle_unexpected(request: Request, _exc: Exception) -> JSONResponse:
        logger.exception("unhandled_error", path=request.url.path)
        return problem(request, 500, "Internal Server Error", "Something went wrong")

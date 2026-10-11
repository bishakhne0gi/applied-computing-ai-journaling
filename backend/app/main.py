import asyncio
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health
from app.api.v1 import api_router
from app.core.config import Settings, get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.core.request_context import REQUEST_ID_HEADER, RequestContextMiddleware
from app.core.sentry import init_sentry
from app.db.session import create_engine, create_sessionmaker
from app.services.live_check import MAX_CONCURRENT_CHECKS
from app.services.writing_assist import MAX_CONCURRENT_CALLS
from journal_ai import Analyzer, CompletionProvider, WritingAssist, build_provider, build_tracer


def _api_key(settings: Settings) -> str | None:
    return settings.anthropic_api_key.get_secret_value() if settings.anthropic_api_key else None


def _build_analyzer(settings: Settings) -> Analyzer:
    provider = build_provider(
        settings.resolved_ai_provider,
        api_key=_api_key(settings),
        model=settings.ai_model,
        effort=settings.ai_effort,
        timeout_seconds=settings.ai_timeout_seconds,
        workspace_id=settings.anthropic_workspace_id,
    )
    secret = settings.langfuse_secret_key.get_secret_value() if settings.langfuse_secret_key else None
    tracer = build_tracer(
        public_key=settings.langfuse_public_key,
        secret_key=secret,
        host=settings.langfuse_host,
        # Langfuse accepts only lower-case environment names.
        environment=settings.environment.lower(),
        release=settings.release,
    )
    return Analyzer(provider, tracer)


def _live_provider(settings: Settings) -> CompletionProvider:
    return build_provider(
        settings.resolved_ai_provider,
        api_key=_api_key(settings),
        model=settings.ai_live_model,
        effort="low",
        timeout_seconds=settings.ai_live_timeout_seconds,
        workspace_id=settings.anthropic_workspace_id,
        # A live call is one attempt: an SDK retry would silently double the worst case past the live timeout.
        max_retries=0,
    )


def _build_live_analyzer(settings: Settings) -> Analyzer:
    # Untraced: checks fire on every pause, and tracing calls nobody stores would multiply Langfuse volume.
    return Analyzer(_live_provider(settings), max_attempts=1)


def _build_writing_assist(settings: Settings) -> WritingAssist:
    # Its own provider instance: each owner closes its own client.
    return WritingAssist(_live_provider(settings))


async def _close_in_order(*closers: Callable[[], Awaitable[None]]) -> None:
    # Every closer runs even when an earlier one fails; the first failure is raised once all have run.
    failure: Exception | None = None
    for close in closers:
        try:
            await close()
        except Exception as exc:
            failure = failure or exc
    if failure is not None:
        raise failure


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level, settings.log_format)
    init_sentry(settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        engine = create_engine(settings.database_url)
        app.state.sessionmaker = create_sessionmaker(engine)
        try:
            yield
        finally:
            # Closes every provider's pooled HTTP client and flushes queued traces before the process exits.
            await _close_in_order(
                app.state.analyzer.aclose,
                app.state.live_analyzer.aclose,
                app.state.writing_assist.aclose,
                engine.dispose,
            )

    app = FastAPI(title="Language Journal API", version=settings.release, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=[REQUEST_ID_HEADER],
    )
    app.add_middleware(RequestContextMiddleware)
    register_exception_handlers(app)
    app.state.analyzer = _build_analyzer(settings)
    app.state.live_analyzer = _build_live_analyzer(settings)
    app.state.live_slots = asyncio.Semaphore(MAX_CONCURRENT_CHECKS)
    app.state.writing_assist = _build_writing_assist(settings)
    app.state.rephrase_slots = asyncio.Semaphore(MAX_CONCURRENT_CALLS)
    app.state.complete_slots = asyncio.Semaphore(MAX_CONCURRENT_CALLS)
    app.include_router(health.router)
    app.include_router(api_router)
    return app

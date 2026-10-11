from collections.abc import AsyncIterator
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
from journal_ai import Analyzer, build_provider, build_tracer


def _build_analyzer(settings: Settings) -> Analyzer:
    api_key = settings.anthropic_api_key.get_secret_value() if settings.anthropic_api_key else None
    provider = build_provider(
        settings.resolved_ai_provider,
        api_key=api_key,
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
            # Closes the provider's pooled HTTP client and flushes queued traces before the process exits.
            try:
                await app.state.analyzer.aclose()
            finally:
                await engine.dispose()

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
    app.include_router(health.router)
    app.include_router(api_router)
    return app

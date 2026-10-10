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
from journal_ai import Analyzer, build_provider


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level, settings.log_format)
    init_sentry(settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        engine = create_engine(settings.database_url)
        app.state.sessionmaker = create_sessionmaker(engine)
        yield
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
    api_key = settings.anthropic_api_key.get_secret_value() if settings.anthropic_api_key else None
    app.state.analyzer = Analyzer(
        build_provider(
            settings.resolved_ai_provider,
            api_key=api_key,
            model=settings.ai_model,
            effort=settings.ai_effort,
            timeout_seconds=settings.ai_timeout_seconds,
            workspace_id=settings.anthropic_workspace_id,
        )
    )
    app.include_router(health.router)
    app.include_router(api_router)
    return app

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import AliasChoices, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

ProviderName = Literal["anthropic", "fake"]


_REPO_ROOT = Path(__file__).resolve().parents[3]
_BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    # Anchored to this file rather than the cwd so `make dev-backend` (repo root), `alembic` (backend/) and
    # pytest all read the same files; the package-local one overrides the root one.
    model_config = SettingsConfigDict(
        env_file=(_REPO_ROOT / ".env", _BACKEND_DIR / ".env"), extra="ignore", populate_by_name=True
    )

    # SENTRY_ENVIRONMENT is what the example env file documents; ENVIRONMENT stays as the fallback.
    environment: str = Field(
        "development", validation_alias=AliasChoices("SENTRY_ENVIRONMENT", "ENVIRONMENT")
    )
    release: str = "dev"
    database_url: str = "postgresql+asyncpg://journal:journal@localhost:5432/journal"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    log_format: Literal["json", "console"] = "console"
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])
    sentry_dsn: str | None = None

    ai_provider: ProviderName | None = None
    ai_model: str = "claude-opus-5-5"
    ai_effort: Literal["low", "medium", "high"] = "medium"
    ai_timeout_seconds: float = 30.0
    # Live hints (POST /check): a fast model, one attempt, a short timeout; nothing is stored.
    ai_live_model: str = "claude-haiku-5-5"
    ai_live_timeout_seconds: float = 8.0
    anthropic_api_key: SecretStr | None = None
    anthropic_workspace_id: str | None = None
    # Tracing is off unless all three are set (journal_ai.build_tracer decides).
    langfuse_public_key: str | None = None
    langfuse_secret_key: SecretStr | None = None
    langfuse_host: str | None = None

    @property
    def resolved_ai_provider(self) -> ProviderName:
        if self.ai_provider:
            return self.ai_provider
        return "anthropic" if self.anthropic_api_key else "fake"


@lru_cache
def get_settings() -> Settings:
    return Settings()

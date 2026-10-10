from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

ProviderName = Literal["anthropic", "fake"]


class Settings(BaseSettings):
    # Root .env first, package-local .env second so `make dev-backend` and `alembic` (run in backend/) agree.
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")

    environment: str = "development"
    release: str = "dev"
    database_url: str = "postgresql+asyncpg://journal:journal@localhost:5432/journal"
    log_level: str = "INFO"
    log_format: Literal["json", "console"] = "console"
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])
    sentry_dsn: str | None = None

    ai_provider: ProviderName | None = None
    ai_model: str = "claude-opus-5-5"
    ai_effort: Literal["low", "medium", "high"] = "medium"
    ai_timeout_seconds: float = 30.0
    anthropic_api_key: SecretStr | None = None

    @property
    def resolved_ai_provider(self) -> ProviderName:
        if self.ai_provider:
            return self.ai_provider
        return "anthropic" if self.anthropic_api_key else "fake"


@lru_cache
def get_settings() -> Settings:
    return Settings()

import pytest
from pydantic import SecretStr

from app.core.config import Settings


def test_defaults_run_locally_with_the_fake_provider() -> None:
    settings = Settings(_env_file=None)

    assert settings.resolved_ai_provider == "fake"
    assert settings.ai_model == "claude-opus-5-5"
    assert settings.log_format == "console"


def test_an_api_key_selects_anthropic_automatically() -> None:
    settings = Settings(_env_file=None, anthropic_api_key=SecretStr("k"))

    assert settings.resolved_ai_provider == "anthropic"


def test_an_explicit_provider_wins_over_the_key() -> None:
    settings = Settings(_env_file=None, anthropic_api_key=SecretStr("k"), ai_provider="fake")

    assert settings.resolved_ai_provider == "fake"


def test_environment_variables_override_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LOG_FORMAT", "json")
    monkeypatch.setenv("CORS_ORIGINS", '["http://a.test"]')

    settings = Settings(_env_file=None)

    assert settings.log_format == "json"
    assert settings.cors_origins == ["http://a.test"]

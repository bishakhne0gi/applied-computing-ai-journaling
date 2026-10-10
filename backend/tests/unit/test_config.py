import pytest
from pydantic import SecretStr, ValidationError

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


def test_sentry_environment_overrides_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "staging")
    monkeypatch.setenv("SENTRY_ENVIRONMENT", "production")

    assert Settings(_env_file=None).environment == "production"


def test_environment_variable_alone_still_works(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "staging")

    assert Settings(_env_file=None).environment == "staging"


def test_environment_can_be_set_by_field_name() -> None:
    assert Settings(_env_file=None, environment="test").environment == "test"


def test_an_unknown_log_level_is_rejected() -> None:
    with pytest.raises(ValidationError):
        Settings(_env_file=None, log_level="LOUD")  # type: ignore[arg-type]


def test_workspace_id_defaults_to_unset_and_reads_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    assert Settings(_env_file=None).anthropic_workspace_id is None

    monkeypatch.setenv("ANTHROPIC_WORKSPACE_ID", "wrkspc_1")

    assert Settings(_env_file=None).anthropic_workspace_id == "wrkspc_1"

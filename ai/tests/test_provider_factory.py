import pytest

from journal_ai.providers.anthropic import AnthropicProvider
from journal_ai.providers.factory import build_provider
from journal_ai.providers.fake import FakeProvider

COMMON = {"model": "claude-opus-5-5", "effort": "medium", "timeout_seconds": 30.0}


def test_builds_the_fake_provider() -> None:
    assert isinstance(build_provider("fake", api_key=None, **COMMON), FakeProvider)


def test_builds_the_anthropic_provider_with_a_key() -> None:
    provider = build_provider("anthropic", api_key="k", **COMMON)

    assert isinstance(provider, AnthropicProvider)
    assert provider.model == "claude-opus-5-5"


def test_anthropic_without_a_key_fails_fast() -> None:
    with pytest.raises(ValueError, match="ANTHROPIC_API_KEY"):
        build_provider("anthropic", api_key=None, **COMMON)


@pytest.mark.parametrize("name", ["fake", "anthropic"])
def test_invalid_effort_fails_fast(name: str) -> None:
    common = {"model": "claude-opus-5-5", "timeout_seconds": 30.0}
    with pytest.raises(ValueError, match="AI_EFFORT"):
        build_provider(name, api_key="k", effort="extreme", **common)  # type: ignore[arg-type]  # name narrowed to Literal at runtime

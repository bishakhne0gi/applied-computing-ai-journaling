from typing import Literal

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
def test_invalid_effort_fails_fast(name: Literal["anthropic", "fake"]) -> None:
    common = {"model": "claude-opus-5-5", "timeout_seconds": 30.0}
    with pytest.raises(ValueError, match="AI_EFFORT"):
        build_provider(name, api_key="k", effort="extreme", **common)


def test_workspace_id_is_passed_to_the_anthropic_provider() -> None:
    provider = build_provider("anthropic", api_key="k", workspace_id="wrkspc_9", **COMMON)

    assert isinstance(provider, AnthropicProvider)
    assert provider._client.default_headers["anthropic-workspace-id"] == "wrkspc_9"


def test_workspace_id_is_ignored_by_the_fake_provider() -> None:
    assert isinstance(build_provider("fake", api_key=None, workspace_id="w", **COMMON), FakeProvider)


def test_the_sdk_retries_once_by_default_and_not_at_all_when_asked() -> None:
    default = build_provider("anthropic", api_key="k", **COMMON)
    single = build_provider("anthropic", api_key="k", max_retries=0, **COMMON)

    assert isinstance(default, AnthropicProvider)
    assert isinstance(single, AnthropicProvider)
    assert (default._client.max_retries, single._client.max_retries) == (1, 0)

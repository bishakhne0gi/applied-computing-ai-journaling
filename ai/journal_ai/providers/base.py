from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Protocol

from journal_ai.schema import Usage


@dataclass(frozen=True)
class Completion:
    text: str
    usage: Usage
    model: str


class ProviderTimeoutError(Exception):
    pass


class ProviderError(Exception):
    pass


class CompletionProvider(Protocol):
    @property
    def model(self) -> str: ...

    async def complete(self, *, system: str, user: str, schema: Mapping[str, Any]) -> Completion: ...

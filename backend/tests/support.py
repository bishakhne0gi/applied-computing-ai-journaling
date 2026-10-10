from collections.abc import Callable
from contextlib import AbstractAsyncContextManager

from fastapi import FastAPI
from httpx import AsyncClient

ClientFactory = Callable[[FastAPI], AbstractAsyncContextManager[AsyncClient]]

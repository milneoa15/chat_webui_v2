"""Reusable FastAPI dependency functions."""
from __future__ import annotations

from collections.abc import AsyncIterator
from functools import lru_cache

import httpx
from cryptography.fernet import Fernet
from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from .config import AppSettings, get_settings
from .database import get_session
from .services.config import ConfigService


async def get_db_session() -> AsyncIterator[AsyncSession]:
    """Yield database sessions for request handling."""
    async for session in get_session():
        yield session


@lru_cache
def _cached_fernet(key: str) -> Fernet:
    return Fernet(key.encode("utf-8"))


def get_fernet(settings: AppSettings = Depends(get_settings)) -> Fernet:
    """Return a cached Fernet instance."""
    return _cached_fernet(settings.fernet_key)


async def get_http_client(
    settings: AppSettings = Depends(get_settings),
) -> AsyncIterator[httpx.AsyncClient]:
    """Provide a configured HTTPX AsyncClient."""
    async with httpx.AsyncClient(timeout=settings.ollama_timeout_seconds) as client:
        yield client


def get_config_service(
    settings: AppSettings = Depends(get_settings),
    fernet: Fernet = Depends(get_fernet),
    session: AsyncSession = Depends(get_db_session),
) -> ConfigService:
    """Construct a ConfigService wired with dependencies."""
    return ConfigService(session=session, settings=settings, fernet=fernet)

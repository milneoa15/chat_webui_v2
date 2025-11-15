"""Reusable FastAPI dependency functions."""
from __future__ import annotations

from collections.abc import AsyncIterator
from functools import lru_cache

import httpx
from cryptography.fernet import Fernet
from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from .config import AppSettings, get_settings
from .database import get_session, get_session_factory
from .services.chat import ChatService
from .services.config import ConfigService
from .services.models import ModelService, get_model_cache
from .services.prompt_builder import PromptBuilder
from .services.sessions import SessionService
from .services.title import TitleService


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


def get_session_service(
    session: AsyncSession = Depends(get_db_session),
) -> SessionService:
    """Provide a SessionService bound to the current DB session."""
    return SessionService(session=session)


def get_prompt_builder() -> PromptBuilder:
    """Return a prompt builder instance."""
    return PromptBuilder()


def get_chat_service(
    session: AsyncSession = Depends(get_db_session),
    settings: AppSettings = Depends(get_settings),
    http_client: httpx.AsyncClient = Depends(get_http_client),
    prompt_builder: PromptBuilder = Depends(get_prompt_builder),
    fernet: Fernet = Depends(get_fernet),
) -> ChatService:
    """Construct the chat streaming service with shared dependencies."""
    config_service = ConfigService(session=session, settings=settings, fernet=fernet)
    session_service = SessionService(session=session)
    return ChatService(
        settings=settings,
        http_client=http_client,
        prompt_builder=prompt_builder,
        config_service=config_service,
        session_service=session_service,
    )


def get_model_service(
    session: AsyncSession = Depends(get_db_session),
    settings: AppSettings = Depends(get_settings),
    http_client: httpx.AsyncClient = Depends(get_http_client),
) -> ModelService:
    """Provide a ModelService wired with the cached store."""
    return ModelService(
        session=session,
        settings=settings,
        http_client=http_client,
        cache=get_model_cache(),
    )


def get_title_service(
    settings: AppSettings = Depends(get_settings),
    fernet: Fernet = Depends(get_fernet),
) -> TitleService:
    """Provide a TitleService that manages its own session scope."""
    session_factory = get_session_factory(settings)
    return TitleService(
        session_factory=session_factory,
        settings=settings,
        fernet=fernet,
    )

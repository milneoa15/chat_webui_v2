"""Database engine configuration and helpers."""
from __future__ import annotations

from typing import AsyncIterator

import structlog
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from .config import AppSettings, get_settings

logger = structlog.get_logger(__name__)

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_engine(settings: AppSettings | None = None) -> AsyncEngine:
    """Return a cached SQLAlchemy async engine configured via settings."""
    global _engine
    if _engine is None:
        resolved_settings = settings or get_settings()
        _engine = create_async_engine(
            resolved_settings.resolved_database_url,
            future=True,
            echo=resolved_settings.environment.lower() == "development",
        )
        logger.info("database.engine_initialized", url=resolved_settings.resolved_database_url)
    return _engine


def get_session_factory(settings: AppSettings | None = None) -> async_sessionmaker[AsyncSession]:
    """Return a cached AsyncSession factory."""
    global _session_factory
    if _session_factory is None:
        engine = get_engine(settings)
        _session_factory = async_sessionmaker(
            bind=engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _session_factory


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency that yields an AsyncSession."""
    session_factory = get_session_factory()
    async with session_factory() as session:
        yield session


async def init_db() -> None:
    """Create database tables on application startup."""
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    logger.info("database.migrations_complete")


async def dispose_engine() -> None:
    """Dispose of the current engine/session cache (primarily used in tests)."""
    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
    _engine = None
    _session_factory = None

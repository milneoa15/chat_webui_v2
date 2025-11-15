"""Business logic for persisted configuration."""
from __future__ import annotations

from datetime import datetime, timezone

import structlog
from cryptography.fernet import Fernet
from fastapi import HTTPException, status
from pydantic import AnyHttpUrl
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..config import AppSettings
from ..models import Config
from ..schemas import ConfigCreate, ConfigRead, ConfigUpdate, GenerationDefaults

logger = structlog.get_logger(__name__)


class ConfigService:
    """Encapsulates CRUD helpers for the Config table."""

    def __init__(self, session: AsyncSession, settings: AppSettings, fernet: Fernet) -> None:
        self.session = session
        self.settings = settings
        self.fernet = fernet

    @staticmethod
    def _utcnow() -> datetime:
        return datetime.now(timezone.utc)

    def _encrypt(self, value: str) -> str:
        return self.fernet.encrypt(value.encode("utf-8")).decode("utf-8")

    def _decrypt(self, value: str) -> str:
        return self.fernet.decrypt(value.encode("utf-8")).decode("utf-8")

    async def _get_existing(self) -> Config | None:
        result = await self.session.exec(select(Config))
        return result.first()

    async def _ensure_default(self) -> Config:
        defaults = GenerationDefaults(
            model=self.settings.default_model,
            temperature=self.settings.default_temperature,
            top_p=self.settings.default_top_p,
            max_tokens=self.settings.default_max_tokens,
        )
        config = Config(
            ollama_base_url_encrypted=self._encrypt(str(self.settings.ollama_base_url)),
            default_model=defaults.model,
            temperature=defaults.temperature,
            top_p=defaults.top_p,
            max_tokens=defaults.max_tokens,
            theme=self.settings.default_theme,
        )
        self.session.add(config)
        await self.session.commit()
        await self.session.refresh(config)
        logger.info("config.created_default")
        return config

    async def get_or_create(self) -> ConfigRead:
        config = await self._get_existing()
        if config is None:
            config = await self._ensure_default()
        return self._to_schema(config)

    async def create(self, payload: ConfigCreate) -> ConfigRead:
        existing = await self._get_existing()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Configuration already exists"
            )
        config = self._model_from_payload(payload)
        self.session.add(config)
        await self.session.commit()
        await self.session.refresh(config)
        logger.info("config.created")
        return self._to_schema(config)

    async def update(self, payload: ConfigUpdate) -> ConfigRead:
        config = await self._get_existing()
        if config is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Config not found")
        if payload.ollama_base_url:
            config.ollama_base_url_encrypted = self._encrypt(str(payload.ollama_base_url))
        if payload.generation_defaults:
            gen = payload.generation_defaults
            config.default_model = gen.model
            config.temperature = gen.temperature
            config.top_p = gen.top_p
            config.max_tokens = gen.max_tokens
        if payload.theme:
            config.theme = payload.theme
        config.updated_at = self._utcnow()
        self.session.add(config)
        await self.session.commit()
        await self.session.refresh(config)
        logger.info("config.updated")
        return self._to_schema(config)

    async def delete(self) -> None:
        config = await self._get_existing()
        if config is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Config not found")
        await self.session.delete(config)
        await self.session.commit()
        logger.info("config.deleted")

    def _model_from_payload(self, payload: ConfigCreate) -> Config:
        return Config(
            ollama_base_url_encrypted=self._encrypt(str(payload.ollama_base_url)),
            default_model=payload.generation_defaults.model,
            temperature=payload.generation_defaults.temperature,
            top_p=payload.generation_defaults.top_p,
            max_tokens=payload.generation_defaults.max_tokens,
            theme=payload.theme,
        )

    def _to_schema(self, config: Config) -> ConfigRead:
        defaults = GenerationDefaults(
            model=config.default_model,
            temperature=config.temperature,
            top_p=config.top_p,
            max_tokens=config.max_tokens,
        )
        return ConfigRead(
            id=config.id or 0,
            ollama_base_url=AnyHttpUrl(self._decrypt(config.ollama_base_url_encrypted)),
            generation_defaults=defaults,
            theme=config.theme,
            created_at=config.created_at,
            updated_at=config.updated_at,
        )

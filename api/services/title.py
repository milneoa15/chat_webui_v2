"""Title generation service using Ollama."""
from __future__ import annotations

import asyncio
import re

import httpx
import structlog
from cryptography.fernet import Fernet
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession

from ..config import AppSettings
from ..models import Session
from ..schemas import ConfigRead
from .config import ConfigService

TITLE_PROMPT_TEMPLATE = (
    "You are a helpful assistant that summarizes chats.\n"
    "Given the latest user message below, produce a short, engaging chat title.\n"
    "It must be <= 6 words, title case, and omit punctuation.\n"
    "Message:\n{message}\n"
    "Title:"
)

logger = structlog.get_logger(__name__)


class TitleService:
    """Generates and persists chat titles by proxying Ollama."""

    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        settings: AppSettings,
        fernet: Fernet,
    ) -> None:
        self.session_factory = session_factory
        self.settings = settings
        self.fernet = fernet

    async def generate_title(self, session_id: int, prompt: str, model: str | None = None) -> str:
        async with self.session_factory() as session:
            session_obj = await session.get(Session, session_id)
            if session_obj is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
            config_service = ConfigService(session=session, settings=self.settings, fernet=self.fernet)
            config: ConfigRead = await config_service.get_or_create()
            base_url = str(config.ollama_base_url).rstrip("/")
            payload = {
                "model": model or config.generation_defaults.model,
                "prompt": TITLE_PROMPT_TEMPLATE.format(message=prompt.strip()),
                "stream": False,
            }
            url = f"{base_url}/api/generate"
            try:
                async with httpx.AsyncClient(timeout=self.settings.ollama_timeout_seconds) as client:
                    response = await client.post(url, json=payload)
                    response.raise_for_status()
                    data = response.json()
                    candidate = data.get("response", "")
                    title = self._sanitize(candidate) or self._fallback(prompt)
            except (httpx.HTTPError, ValueError) as exc:
                logger.warning("title.generate_http_error", error=str(exc))
                title = self._fallback(prompt)
            session_obj.title = title
            session.add(session_obj)
            await session.commit()
            await session.refresh(session_obj)
            logger.info("title.generated", session_id=session_obj.id, title=title)
            return title

    def queue_title_generation(self, session_id: int, prompt: str, model: str | None = None) -> None:
        """Schedule title generation without blocking the caller."""

        async def _runner() -> None:
            try:
                await self.generate_title(session_id, prompt, model=model)
            except HTTPException:
                logger.warning("title.generate_session_missing", session_id=session_id)
            except Exception:
                logger.exception("title.generate_background_error", session_id=session_id)

        asyncio.create_task(_runner())

    @staticmethod
    def _sanitize(candidate: str) -> str:
        candidate = candidate.strip().strip("\"'`")
        candidate = re.sub(r"[\r\n]+", " ", candidate)
        candidate = re.sub(r"[^A-Za-z0-9 ]+", "", candidate)
        candidate = candidate.title()
        return candidate[:60].strip()

    @staticmethod
    def _fallback(prompt: str) -> str:
        cleaned = prompt.strip()
        lines = cleaned.splitlines()
        preview = lines[0] if lines else cleaned
        preview = preview or "New Chat"
        trimmed = preview[:60].strip()
        return trimmed.title() if trimmed else "New Chat"

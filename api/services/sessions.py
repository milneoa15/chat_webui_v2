"""Session + message persistence helpers."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import asc, desc, func
from sqlmodel import delete, select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..models import Message, MessageRole, PromptMeta, Session
from ..schemas import MessageCreate, MessageRead, SessionCreate, SessionRead, SessionUpdate


class SessionService:
    """Encapsulates CRUD helpers for sessions, messages, and prompt metadata."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    @staticmethod
    def _utcnow() -> datetime:
        return datetime.now(timezone.utc)

    async def _get_session(self, session_id: int) -> Session:
        session_obj = await self.session.get(Session, session_id)
        if session_obj is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
        return session_obj

    async def list_sessions(self) -> list[Session]:
        statement = select(Session).order_by(desc("updated_at"))
        result = await self.session.exec(statement)
        items = list(result)
        return items

    async def create_session(self, payload: SessionCreate) -> Session:
        title = payload.title.strip() if payload.title else "New Chat"
        session_obj = Session(title=title or "New Chat")
        self.session.add(session_obj)
        await self.session.commit()
        await self.session.refresh(session_obj)
        return session_obj

    async def update_session(self, session_id: int, payload: SessionUpdate) -> Session:
        session_obj = await self._get_session(session_id)
        session_obj.title = payload.title.strip() or session_obj.title
        session_obj.updated_at = self._utcnow()
        self.session.add(session_obj)
        await self.session.commit()
        await self.session.refresh(session_obj)
        return session_obj

    async def delete_session(self, session_id: int) -> None:
        session_obj = await self._get_session(session_id)
        await self.session.exec(delete(Message).where(Message.session_id == session_id))  # type: ignore[arg-type]
        await self.session.exec(delete(PromptMeta).where(PromptMeta.session_id == session_id))  # type: ignore[arg-type]
        await self.session.delete(session_obj)
        await self.session.commit()

    async def add_message(
        self, session_id: int, payload: MessageCreate
    ) -> tuple[Message, Session]:
        session_obj = await self._get_session(session_id)
        message = Message(
            session_id=session_obj.id,
            role=MessageRole(payload.role),
            content=payload.content,
            model=payload.model,
            prompt_tokens=payload.prompt_tokens,
            completion_tokens=payload.completion_tokens,
            total_tokens=payload.total_tokens,
            metrics=payload.metrics,
        )
        session_obj.updated_at = self._utcnow()
        self.session.add(message)
        self.session.add(session_obj)
        await self.session.commit()
        await self.session.refresh(message)
        await self.session.refresh(session_obj)
        return message, session_obj

    async def list_messages(
        self, session_id: int, *, limit: int, offset: int
    ) -> tuple[list[Message], int]:
        await self._get_session(session_id)
        query = (
            select(Message)
            .where(Message.session_id == session_id)
            .order_by(asc("created_at"))
            .offset(offset)
            .limit(limit)
        )
        result = await self.session.exec(query)
        items = list(result)
        total_query = select(func.count()).select_from(Message).where(Message.session_id == session_id)
        total_result = await self.session.exec(total_query)
        total_row = total_result.one()
        if isinstance(total_row, tuple):
            total_value = total_row[0]
        else:
            total_value = total_row
        total = int(total_value or 0)
        return items, total

    async def record_prompt_meta(
        self,
        session_id: int,
        *,
        model: str,
        author_role: MessageRole = MessageRole.SYSTEM,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        plugin_trace: dict[str, Any] | None = None,
    ) -> PromptMeta:
        session_obj = await self._get_session(session_id)
        meta = PromptMeta(
            session_id=session_obj.id,
            model=model,
            author_role=author_role,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            plugin_trace=plugin_trace or {},
        )
        self.session.add(meta)
        await self.session.commit()
        await self.session.refresh(meta)
        return meta

    @staticmethod
    def to_session_read(session_obj: Session) -> SessionRead:
        return SessionRead(
            id=session_obj.id or 0,
            title=session_obj.title,
            created_at=session_obj.created_at,
            updated_at=session_obj.updated_at,
        )

    @staticmethod
    def to_message_read(message: Message) -> MessageRead:
        return MessageRead(
            id=message.id or 0,
            session_id=message.session_id,
            role=message.role.value if isinstance(message.role, MessageRole) else message.role,
            content=message.content,
            model=message.model,
            prompt_tokens=message.prompt_tokens,
            completion_tokens=message.completion_tokens,
            total_tokens=message.total_tokens,
            metrics=message.metrics or {},
            created_at=message.created_at,
        )

    @staticmethod
    def should_generate_title(session_obj: Session) -> bool:
        """Return True when the session title is still the default placeholder."""
        placeholder_titles = {"", "New Chat", "Untitled"}
        return (session_obj.title or "").strip() in placeholder_titles

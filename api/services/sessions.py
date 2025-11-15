"""Session + message persistence helpers."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import asc, desc, func
from sqlmodel import delete, select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..models import Message, MessageRole, PromptMeta, Session, SessionModelLink
from ..schemas import (
    MessageCreate,
    MessageMetrics,
    MessageRead,
    SessionCreate,
    SessionMetricsResponse,
    SessionRead,
    SessionUpdate,
)


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

    async def _record_session_model(self, session_id: int, model_name: str) -> None:
        norm = model_name.strip()
        if not norm:
            return
        query = select(SessionModelLink).where(
            SessionModelLink.session_id == session_id,
            SessionModelLink.model_name == norm,
        )
        result = await self.session.exec(query)
        row = result.first()
        if row:
            row.last_used_at = self._utcnow()
            self.session.add(row)
        else:
            self.session.add(SessionModelLink(session_id=session_id, model_name=norm))

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
            is_pinned=payload.is_pinned,
        )
        session_obj.updated_at = self._utcnow()
        self.session.add(message)
        self.session.add(session_obj)
        session_id_value = session_obj.id
        if payload.model and session_id_value is not None:
            await self._record_session_model(session_id_value, payload.model)
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

    async def recent_messages(self, session_id: int, limit: int = 200) -> list[Message]:
        await self._get_session(session_id)
        query = (
            select(Message)
            .where(Message.session_id == session_id)
            .order_by(desc("created_at"))
            .limit(limit)
        )
        result = await self.session.exec(query)
        items = list(result)
        items.reverse()
        return items

    async def get_message(self, message_id: int, *, session_id: int | None = None) -> Message:
        message = await self.session.get(Message, message_id)
        if message is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
        if session_id is not None and message.session_id != session_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
        return message

    async def delete_message(self, session_id: int, message_id: int) -> None:
        await self._get_session(session_id)
        message = await self.get_message(message_id, session_id=session_id)
        await self.session.delete(message)
        await self.session.commit()

    async def set_message_pin(self, session_id: int, message_id: int, pinned: bool) -> Message:
        await self._get_session(session_id)
        message = await self.get_message(message_id, session_id=session_id)
        message.is_pinned = pinned
        self.session.add(message)
        await self.session.commit()
        await self.session.refresh(message)
        return message

    async def prepare_regeneration(
        self, session_id: int, assistant_message_id: int, *, delete: bool = True
    ) -> tuple[Message, Message]:
        """Optionally delete the assistant message and return both assistant + user rows."""

        assistant = await self.get_message(assistant_message_id, session_id=session_id)
        if MessageRole(assistant.role) is not MessageRole.ASSISTANT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only assistant messages can be regenerated",
            )
        query = (
            select(Message)
            .where(Message.session_id == session_id)
            .where(Message.role == MessageRole.USER)
            .where(Message.created_at <= assistant.created_at)
            .order_by(desc("created_at"))
            .limit(1)
        )
        result = await self.session.exec(query)
        user_message = result.first()
        if user_message is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to locate user prompt for regeneration",
            )
        if delete:
            await self.session.delete(assistant)
            await self.session.commit()
        return assistant, user_message

    async def collect_metrics(self, session_id: int) -> SessionMetricsResponse:
        await self._get_session(session_id)
        query = (
            select(Message)
            .where(Message.session_id == session_id)
            .order_by(asc("created_at"))
        )
        result = await self.session.exec(query)
        messages = list(result)
        total_prompt = 0
        total_completion = 0
        metric_items: list[MessageMetrics] = []
        for message in messages:
            prompt_tokens = int(message.prompt_tokens or 0)
            completion_tokens = int(message.completion_tokens or 0)
            if message.role == MessageRole.USER:
                total_prompt += prompt_tokens
            else:
                total_completion += completion_tokens
            metric_items.append(
                MessageMetrics(
                    message_id=message.id or 0,
                    role=message.role.value if isinstance(message.role, MessageRole) else message.role,
                    prompt_tokens=message.prompt_tokens,
                    completion_tokens=message.completion_tokens,
                    total_tokens=message.total_tokens,
                    metrics=message.metrics or {},
                )
            )
        return SessionMetricsResponse(
            session_id=session_id,
            total_prompt_tokens=total_prompt,
            total_completion_tokens=total_completion,
            total_messages=len(messages),
            messages=metric_items,
        )

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
            is_pinned=message.is_pinned,
            created_at=message.created_at,
        )

    @staticmethod
    def should_generate_title(session_obj: Session) -> bool:
        """Return True when the session title is still the default placeholder."""
        placeholder_titles = {"", "New Chat", "Untitled"}
        return (session_obj.title or "").strip() in placeholder_titles
